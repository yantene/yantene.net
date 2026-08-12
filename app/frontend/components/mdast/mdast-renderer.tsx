import { raw } from "hast-util-raw";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { toHast } from "mdast-util-to-hast";
import { useEffect, useMemo, useRef, useState } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { createPortal } from "react-dom";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import { unified } from "unified";
import { normalizeEmbedSrc } from "./embed";
import type { Element, Root as HastRoot, RootContent } from "hast";
import type { Html, Root as MdastRoot } from "mdast";
import type { Handler, Raw, State } from "mdast-util-to-hast";

/*
 * sanitize に iframe を通す。本文には生の iframe (YouTube の埋め込み) が書かれており、
 * これを落とすと動画が跡形もなく消える。
 *
 * ここで許すのはタグと属性の形だけで、載せてよい相手かどうかは見ていない。src の中身は
 * 後段 (toEmbed) が決め打ちの相手に絞る。二段構えにしているのは、sanitize の
 * schema がホスト単位の判断を表せないため。
 */
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "iframe"],
  attributes: {
    ...defaultSchema.attributes,
    iframe: ["src", "title", "allow", "allowFullScreen", "loading"],
  },
};

/** 本文に直接書かれた HTML が埋め込みかどうか。属性の中身までは見ない。 */
const hasIframe = (html: string): boolean => /<iframe[\s/>]/i.test(html);

/**
 * MDAST → HAST のハンドラ差し替え。生 HTML のうち埋め込みだけを後段へ通す。
 *
 * 生 HTML は既定では捨てられる。過去の記事には Markdown 記法を抱えたままの p 要素や、
 * 外部スクリプト前提の Twitter 引用が残っており、要素として起こすと
 * `![](./foo.png)` のような素の文字列が本文に出てしまうため、捨てたままにしておきたい。
 * ただし埋め込みだけは、捨てると動画が跡形もなく消える。ここで選り分ける。
 *
 * 通した先で何が残るかは rehypeSanitize と toEmbed が決めるので、
 * この関数は「埋め込みが書かれていそうか」だけを見れば足りる。
 */
function keepEmbedHtml(state: State, node: Html): ReturnType<Handler> {
  if (!hasIframe(node.value)) return undefined;
  const result: Raw = { type: "raw", value: node.value };
  state.patch(node, result);
  return state.applyData(node, result);
}

/** 生 HTML の断片 (raw) がツリーに残っているか。 */
function hasRawNode(node: HastRoot | RootContent): boolean {
  if (node.type === "raw") return true;
  return "children" in node && node.children.some((child) => hasRawNode(child));
}

/**
 * 通した生 HTML を、実際の要素として組み直す。
 *
 * toHast が持たせる raw はまだ文字列のままで、要素ではない。ここを通さないと後段からは
 * iframe が見えず、sanitize が raw ごと捨てて本文から消える。
 *
 * ただし raw の展開はツリー全体を HTML へ直して読み直す処理なので、断片が無いときは
 * 触らない。埋め込みを持つ記事はごく一部で、他の記事まで毎回往復させる意味がないうえ、
 * 読み直しの過程でブロック要素の間の空白ノードが動くなど、無関係な差が出る。
 */
function expandRawHtml(tree: HastRoot): HastRoot {
  if (!hasRawNode(tree)) return tree;
  // raw() は任意のノードを受ける型なので戻りが広い。根を渡せば根が返る。
  return raw(tree) as HastRoot;
}

// hast (HTML AST) 段でのプラグイン。runSync で同期実行できるため SSR でもそのまま使える。
// - rehypeSanitize: 危険な URL スキーム (javascript:/data: 等) や属性を除去する。
//   raw を組み直した直後に通し、後続の slug/highlight が付ける id・className は温存する
//   (単著コンテンツだが XSS の多層防御として入れる)
// - rehypeSlug: 見出しに id を付与し目次リンクを可能にする
// - rehypeHighlight: フェンス付きコードにトークンクラスを付与する
//   (未知の言語指定はハイライトせず素通しするだけで throw しない)
const hastProcessor = unified()
  .use(rehypeSanitize, sanitizeSchema)
  .use(rehypeSlug)
  .use(rehypeHighlight);

// 別タブ + rel を付ける対象。http(s) 絶対 URL とプロトコル相対 (//host) を外部扱いにする。
const isExternalHref = (href: string): boolean =>
  href.startsWith("//") ||
  href.startsWith("http://") ||
  href.startsWith("https://");

/** img 要素: 相対 URL を解決し、遅延読み込み・非同期デコードを既定にする。 */
function transformImage(
  element: Element,
  resolve: ((src: string) => string) | undefined,
): void {
  const src = element.properties.src;
  if (typeof src === "string" && resolve !== undefined) {
    element.properties.src = resolve(src);
  }
  element.properties.loading = "lazy";
  element.properties.decoding = "async";
  element.properties.alt ??= "";
}

/** hast の className (配列とも文字列とも取れる) をクラスの列に均す。 */
function toClassList(value: unknown): readonly string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") return value.split(" ").filter(Boolean);
  return [];
}

/**
 * a 要素: 外部リンクは別タブで開き、noreferrer 等を付けて安全にする。
 *
 * 押下の反応 (press-control) もここで足す。本文中のリンクは MDAST から起こすので
 * 書き手がクラスを付けられず、ここで足さないと本文の中だけ手応えが無くなる。
 */
function transformAnchor(element: Element): void {
  element.properties.className = [
    ...toClassList(element.properties.className),
    "press-control",
  ];

  const href = element.properties.href;
  if (typeof href === "string" && isExternalHref(href)) {
    element.properties.target = "_blank";
    element.properties.rel = ["noopener", "noreferrer", "nofollow"];
  }
}

/**
 * iframe 要素: 決めた相手の埋め込みだけを残す。
 *
 * 通してよければ載せる形に整えた要素を返し、通せなければ null を返す (呼び出し元が
 * 要素ごと取り除く)。属性を引き継がず一から組むのは、本文側が sandbox や
 * referrerpolicy を好きに書けてしまうと、ここで絞る意味がなくなるため。
 */
function toEmbed(element: Element): Element | null {
  const src = element.properties.src;
  const normalized = typeof src === "string" ? normalizeEmbedSrc(src) : null;
  if (normalized === null) return null;

  const title = element.properties.title;
  return {
    ...element,
    properties: {
      src: normalized,
      title: typeof title === "string" && title !== "" ? title : "埋め込み動画",
      loading: "lazy",
      // 出どころは伝える必要がある。YouTube は埋め込み元を見て可否を決めており、
      // no-referrer にすると再生を断られる (プレーヤーの設定エラー)。読んでいる
      // 記事のパスまでは渡らない、ブラウザ既定と同じ方針に留める。
      referrerPolicy: "strict-origin-when-cross-origin",
      allow: "accelerometer; encrypted-media; picture-in-picture; fullscreen",
      allowFullScreen: true,
    },
    children: [],
  };
}

/**
 * hast ツリーを再帰的に走査し、img / a / iframe 要素へ変換を適用する。toHast が毎回新しい
 * ツリーを生成するため、ここでの破壊的変更は入力の MDAST には影響しない。
 */
function applyElementTransforms(
  node: HastRoot | RootContent,
  resolveImageUrl: ((src: string) => string) | undefined,
): void {
  if (node.type === "element") {
    if (node.tagName === "img") transformImage(node, resolveImageUrl);
    else if (node.tagName === "a") transformAnchor(node);
  }
  if ("children" in node) {
    // 埋め込みは形を整えたものに差し替え、通せないものはここで落とす。
    node.children = node.children.flatMap((child) => {
      if (child.type !== "element" || child.tagName !== "iframe")
        return [child];
      const embed = toEmbed(child);
      return embed === null ? [] : [embed];
    });
    for (const child of node.children) {
      applyElementTransforms(child, resolveImageUrl);
    }
  }
}

/** コードブロック (pre) 差し替え: 右上にコピーボタンを添える。 */
function CodeBlock(
  props: Readonly<React.ComponentPropsWithoutRef<"pre">>,
): React.JSX.Element {
  const ref = useRef<HTMLPreElement>(null);
  const [isCopied, setIsCopied] = useState(false);

  async function copy(): Promise<void> {
    const text = ref.current?.textContent ?? "";
    try {
      await globalThis.navigator.clipboard.writeText(text);
      setIsCopied(true);
      globalThis.setTimeout(() => setIsCopied(false), 1500);
    } catch {
      // クリップボード API が使えない環境 (非セキュアコンテキスト等) では何もしない。
    }
  }

  return (
    <div className="code-block">
      <button
        type="button"
        className="code-copy press-control"
        onClick={() => void copy()}
        aria-label="コードをコピー"
      >
        {isCopied ? "コピーしました" : "コピー"}
      </button>
      <pre ref={ref} {...props} />
    </div>
  );
}

/** 画像 (img) 差し替え: クリックで lightbox 拡大 (Esc / 背景クリックで閉じる)。 */
function LightboxImage(
  props: Readonly<React.ComponentPropsWithoutRef<"img">>,
): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    function onKey(event: KeyboardEvent): void {
      if (event.key === "Escape") setIsOpen(false);
    }
    globalThis.addEventListener("keydown", onKey);
    return () => globalThis.removeEventListener("keydown", onKey);
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        className="lightbox-trigger press-control"
        onClick={() => setIsOpen(true)}
        aria-label="画像を拡大"
      >
        <img {...props} alt={props.alt ?? ""} />
      </button>
      {isOpen &&
        createPortal(
          // オーバーレイ自体を button にして、背景クリック・Enter/Space・Esc
          // (グローバル keydown) のいずれでも閉じられるようにする。
          //
          // ここだけは押下の反応 (press-control) を付けない。画面いっぱいの暗幕を
          // 押している間だけ薄くすると、後ろのページが透けて明滅する。
          // 押した結果 (暗幕が消える) がその場で出るので、手応えは足りている。
          <button
            type="button"
            className="lightbox-overlay"
            aria-label="拡大画像を閉じる"
            onClick={() => setIsOpen(false)}
          >
            <img
              className="lightbox-full"
              src={props.src}
              alt={props.alt ?? ""}
            />
          </button>,
          document.body,
        )}
    </>
  );
}

/** 埋め込み (iframe) 差し替え: 幅に追随する枠に収める。 */
function Embed(
  props: Readonly<React.ComponentPropsWithoutRef<"iframe">>,
): React.JSX.Element {
  return (
    <div className="note-embed">
      <iframe {...props} title={props.title ?? "埋め込み動画"} />
    </div>
  );
}

export interface MdastRendererProps {
  /** レンダリング対象の MDAST (Markdown AST) ルート。 */
  readonly node: MdastRoot;
  /**
   * 画像 URL を解決する関数。相対パスをアセット API URL に変換したい場合に注入する。
   * 省略時は素通し (URL は既に解決済みという前提)。
   */
  readonly transformImageUrl?: (src: string) => string;
  /** ルート要素に付与する追加クラス。 */
  readonly className?: string;
}

/**
 * MDAST を React 要素に変換して描画する (MDAST → HAST → React)。
 * サーバー側では本文を HTML 化せず MDAST のまま渡し、ここでレンダリングする (ADR 0005)。
 */
export function MdastRenderer({
  node,
  transformImageUrl,
  className,
}: MdastRendererProps): React.JSX.Element {
  const content = useMemo(() => {
    // allowDangerousHtml で生 HTML を hast へ運べるようにし、実際に何を運ぶかは
    // keepEmbedHtml が選ぶ (既定の挙動どおり、埋め込み以外の生 HTML は捨てる)。
    const hast = toHast(node, {
      allowDangerousHtml: true,
      handlers: { html: keepEmbedHtml },
    }) as HastRoot;
    const transformed = hastProcessor.runSync(expandRawHtml(hast));
    applyElementTransforms(transformed, transformImageUrl);

    return toJsxRuntime(transformed, {
      Fragment,
      jsx,
      jsxs,
      components: { pre: CodeBlock, img: LightboxImage, iframe: Embed },
    }) as React.JSX.Element;
  }, [node, transformImageUrl]);

  return (
    <article
      className={`note-prose prose max-w-none ${className ?? ""}`.trim()}
    >
      {content}
    </article>
  );
}
