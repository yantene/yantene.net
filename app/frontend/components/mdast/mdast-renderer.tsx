import { raw } from "hast-util-raw";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { defaultHandlers, toHast } from "mdast-util-to-hast";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { createPortal } from "react-dom";
import { Link } from "react-router";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import { unified } from "unified";
import { Alert } from "./alert";
import { isNoteAssetSrc } from "./audio";
import { normalizeEmbedSrc } from "./embed";
import { mathMlAttributes, mathMlDescendants, mathMlTagNames } from "./mathml";
import { MermaidDiagram } from "./mermaid-diagram";
import type {
  Element,
  ElementContent,
  Root as HastRoot,
  RootContent,
} from "hast";
import type { Html, Paragraph, Root as MdastRoot } from "mdast";
import type { Handler, Raw, State } from "mdast-util-to-hast";
import type {
  LinkCardMap,
  LinkCardView,
} from "~/backend/handlers/link-cards/link-card-view";
import { ALERT_TAG_NAME } from "~/backend/services/note-content-parser";
import { LinkCard } from "~/frontend/components/link-card/link-card";
import { collectBareLinkParagraphs } from "~/lib/link-card/bare-link";

/** カードに差し替える段落を表す、Markdown 記法には無い要素名。 */
const LINK_CARD_TAG = "link-card";

/** 図に差し替えるコードブロックを包む、本文には現れない要素名。 */
const MERMAID_TAG = "mermaid-diagram";

/** Mermaid のコードブロックを表すクラス。```mermaid のフェンスから付く。 */
const MERMAID_CLASS = "language-mermaid";

/*
 * カードの中身を描画側へ渡す道。
 *
 * hast を通せるのは URL 1 つだけなので、中身は文脈に載せる。toJsxRuntime に渡す
 * components は要素の属性しか受け取らず、外側の値を閉じ込められないため。
 */
const LinkCardsContext = createContext<ReadonlyMap<string, LinkCardView>>(
  new Map(),
);

/*
 * sanitize に iframe を通す。本文には生の iframe (YouTube の埋め込み) が書かれており、
 * これを落とすと動画が跡形もなく消える。
 *
 * ここで許すのはタグと属性の形だけで、載せてよい相手かどうかは見ていない。src の中身は
 * 後段 (toEmbed) が決め打ちの相手に絞る。二段構えにしているのは、sanitize の
 * schema がホスト単位の判断を表せないため。
 *
 * 数式の MathML も通す。refresh 時に組んだ木を MDAST の hChildren として運んでいるので
 * (ADR 0013)、schema に無いタグ・属性はここで落ちてしまう。allowlist の中身は
 * mathml.ts を参照。`<math>` の外に単独で現れた MathML 要素は ancestors で落とす。
 */
const sanitizeSchema = {
  ...defaultSchema,
  /*
   * id への前置は toHast に任せ、ここでは足さない。
   *
   * 両方が既定の `user-content-` を当てると、脚注の id にだけ二重に乗る。toHast は
   * id と href の両方を前置するが、sanitize が前置するのは id と aria-describedby
   * だけで href は据え置くため、`href="#user-content-fn-1"` が
   * `id="user-content-user-content-fn-1"` を探しにいって行き先を見失う (#268)。
   *
   * DOM clobbering への備えが消えるわけではない。脚注の id は toHast が
   * `user-content-` を付けたものがそのまま残る。素通しになるのは本文が生 HTML に
   * 自分で書いた id だが、生 HTML が通るのは iframe か audio を含むブロックだけで
   * (keepEmbedHtml)、iframe は toEmbed が属性を一から組み直して id を落とす。
   * 残るのは音源の周りに書いた id で、本文を書けるのが書き手自身に限られる以上
   * (下記の link-card と同じ理由)、ここは許容する。
   *
   * 逆に toHast 側の前置を外しても直らない。id は sanitize が前置して
   * `user-content-fn-1`、href は素の `#fn-1` のままで、ずれが残る。
   */
  clobberPrefix: "",
  // link-card はこちらが組み立てた印 (linkCardParagraph が起こす) だが、本文から書けない
  // わけではない。iframe か audio を含む生 HTML のブロックは keepEmbedHtml が丸ごと通すので、
  // そこに並べれば要素として残る。塞いでいないのは、運ぶのが URL 1 つだけで出力は
  // LinkCardSlot がもう一度絞るうえ、本文を書けるのが書き手自身に限られるため。
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "iframe",
    "audio",
    "source",
    LINK_CARD_TAG,
    ALERT_TAG_NAME,
    ...mathMlTagNames,
  ],
  attributes: {
    ...defaultSchema.attributes,
    iframe: ["src", "title", "allow", "allowFullScreen", "loading"],
    // 音源も iframe と同じ二段構え。ここで許すのは形だけで、src の中身は
    // 後段 (toAudio) が自分のアセット API に絞る。
    audio: ["controls", "preload"],
    source: ["src", "type"],
    [LINK_CARD_TAG]: ["url"],
    // Alert も link-card と同じくこちらが組み立てた印で、同じ経路なら本文からも書ける。
    // 運ぶのは種別 1 つだけ (note-content-parser.ts が引用から起こす)。
    [ALERT_TAG_NAME]: ["kind"],
    ...Object.fromEntries(
      mathMlTagNames.map((tagName) => [tagName, [...mathMlAttributes]]),
    ),
  },
  ancestors: {
    ...defaultSchema.ancestors,
    ...Object.fromEntries(
      mathMlDescendants.map((tagName) => [tagName, ["math"]]),
    ),
  },
};

/** 本文に直接書かれた HTML が埋め込みかどうか。属性の中身までは見ない。 */
const hasIframe = (html: string): boolean => /<iframe[\s/>]/i.test(html);

/** 本文に直接書かれた HTML が音源かどうか。属性の中身までは見ない。 */
const hasAudio = (html: string): boolean => /<audio[\s/>]/i.test(html);

/**
 * MDAST → HAST のハンドラ差し替え。生 HTML のうち埋め込みと音源だけを後段へ通す。
 *
 * 生 HTML は既定では捨てられる。過去の記事には Markdown 記法を抱えたままの p 要素や、
 * 外部スクリプト前提の Twitter 引用が残っており、要素として起こすと
 * `![](./foo.png)` のような素の文字列が本文に出てしまうため、捨てたままにしておきたい。
 * ただし埋め込みと音源だけは、捨てると動画や曲が跡形もなく消える。ここで選り分ける。
 *
 * 通した先で何が残るかは rehypeSanitize と toEmbed / toAudio が決めるので、
 * この関数は「そう書かれていそうか」だけを見れば足りる。
 */
function keepEmbedHtml(state: State, node: Html): ReturnType<Handler> {
  if (!hasIframe(node.value) && !hasAudio(node.value)) return undefined;
  const result: Raw = { type: "raw", value: node.value };
  state.patch(node, result);
  return state.applyData(node, result);
}

/**
 * MDAST → HAST のハンドラ差し替え。カード化する段落を印つきの要素に置き換える。
 *
 * 段落そのもの (ノードの同一性) で照合する。位置で数えると、脚注やリストを跨いだときに
 * ずれる。差し替えを MDAST の書き換えではなく変換時に行うのは、入力の木を汚さないため。
 */
function linkCardParagraph(targets: ReadonlyMap<Paragraph, string>): Handler {
  return (state: State, node: Paragraph): ReturnType<Handler> => {
    const url = targets.get(node);
    if (url === undefined) return defaultHandlers.paragraph(state, node);

    const result: Element = {
      type: "element",
      tagName: LINK_CARD_TAG,
      properties: { url },
      children: [],
    };
    state.patch(node, result);
    return state.applyData(node, result);
  };
}

/**
 * 印のついた要素を実際のカードにする。
 *
 * 中身が見つからないときは素のリンクに戻す。カードにできなかっただけで本文から
 * URL が消えるのは、静かに壊れているのと変わらない。
 *
 * 素のリンクに落とすときは、ここでもう一度スキームを確かめる。印を付けるのは
 * こちら側 (linkCardParagraph) だけで、そこは http(s) しか通していないが、
 * href に値を渡す場所で二度目の関門を持たせておく。
 */
function LinkCardSlot({ url }: { readonly url?: string }): React.JSX.Element {
  const cards = useContext(LinkCardsContext);
  const card = url === undefined ? undefined : cards.get(url);

  if (card === undefined) {
    const href = url !== undefined && isExternalHref(url) ? url : undefined;
    return (
      <p>
        <a
          className="press-control"
          href={href}
          target="_blank"
          rel="noopener noreferrer nofollow"
        >
          {url}
        </a>
      </p>
    );
  }
  return <LinkCard card={card} />;
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
 * audio 要素: 自分のアセットを指す音源だけを残す。
 *
 * toEmbed と同じく、通せるものは一から組み直して返し、通せなければ null を返す。
 * 属性を引き継がないのは、本文側が autoplay や loop を書けてしまうと絞る意味が
 * 無くなるため。当時のページは `<embed autostart loop>` で強制再生していたが、
 * それを再現はしない。
 *
 * source が 1 つも残らなければ音源ごと落とす。鳴らない再生バーだけが残るのは、
 * 静かに壊れているのと変わらない。
 */
function toAudio(element: Element): Element | null {
  const sources = element.children.flatMap((child) => {
    if (child.type !== "element" || child.tagName !== "source") return [];
    const src = child.properties.src;
    if (typeof src !== "string" || !isNoteAssetSrc(src)) return [];
    const type = child.properties.type;
    return [
      {
        ...child,
        properties: {
          src,
          ...(typeof type === "string" && type !== "" && { type }),
        },
        children: [],
      },
    ];
  });
  if (sources.length === 0) return null;

  return {
    ...element,
    properties: { controls: true, preload: "none" },
    children: sources,
  };
}

/**
 * hast ツリーを再帰的に走査し、img / a / iframe / audio 要素へ変換を適用する。toHast が
 * 毎回新しいツリーを生成するため、ここでの破壊的変更は入力の MDAST には影響しない。
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
    // 音源も同じ。走査を分けているのは、1 つの flatMap に畳むと戻り値の型が
    // 子の型と Element の合併になり、children へ代入できなくなるため。
    node.children = node.children.flatMap((child) => {
      if (child.type !== "element" || child.tagName !== "audio") return [child];
      const audio = toAudio(child);
      return audio === null ? [] : [audio];
    });
    for (const child of node.children) {
      applyElementTransforms(child, resolveImageUrl);
    }
  }
}

/** 要素の下にあるテキストを連結する。コードブロックの中身を取り出すのに使う。 */
function textOf(node: ElementContent): string {
  if (node.type === "text") return node.value;
  if (node.type === "element")
    return node.children.map((child) => textOf(child)).join("");
  return "";
}

/**
 * Mermaid のコードブロックなら、その中身を返す。そうでなければ null を返す。
 *
 * 見るのは `<pre>` の下に `<code class="language-mermaid">` が 1 つだけある形。
 * rehype-highlight は登録の無い言語 (mermaid はそう) を素通しするので、この段でも
 * 中身は書いたままのテキストで残っている。
 */
function mermaidSource(element: Element): string | null {
  if (element.tagName !== "pre") return null;
  if (element.children.length !== 1) return null;

  const [code] = element.children;
  if (code.type !== "element" || code.tagName !== "code") return null;
  if (!toClassList(code.properties.className).includes(MERMAID_CLASS))
    return null;

  return textOf(code);
}

/**
 * Mermaid のコードブロックを、図に差し替えるための要素で包む。
 *
 * 差し替えではなく「包む」のは、組み上がるまでと組めなかったときに出すものが、元の
 * コードブロックそのものだから (MermaidDiagram がそれを children として受け取る)。
 * ソースは属性として渡す。要素の中のテキストを描画時に読み直すこともできるが、
 * コピーボタンの文字まで混ざるうえ、コードブロックの組み方に依存してしまう。
 *
 * 子から先に降りてから包む。包んだ結果に降りると、その中の `<pre>` をもう一度包み続ける。
 *
 * sanitize は既に通ったあとで呼ぶ。`MERMAID_TAG` を allowlist に足さずに済むので、
 * 本文の生 HTML からこの要素を騙って書くことができない。
 */
function wrapMermaidBlocks(node: HastRoot | RootContent): void {
  if (!("children" in node)) return;

  for (const child of node.children) wrapMermaidBlocks(child);

  node.children = node.children.map((child) => {
    if (child.type !== "element") return child;
    const source = mermaidSource(child);
    if (source === null) return child;

    return {
      type: "element",
      tagName: MERMAID_TAG,
      properties: { source },
      children: [child],
    } satisfies Element;
  });
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

/**
 * a 要素: ページ内アンカーだけ React Router の Link に通す。
 *
 * 素の `<a href="#...">` は `<ScrollRestoration>` がブラウザのハッシュジャンプを
 * 打ち消すためスクロールしない (目次が Link を使っているのと同じ理由)。本文で
 * ページ内アンカーになるのは脚注の行き来なので、これが無いと注へ飛べない。
 *
 * 外部・内部リンクは素の `<a>` のまま返す。Router の文脈を要らない場所でも
 * 描けるようにしておくため。
 */
function Anchor({
  href,
  children,
  ...rest
}: Readonly<React.ComponentPropsWithoutRef<"a">>): React.JSX.Element {
  if (href === undefined || !href.startsWith("#")) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link to={href} {...rest}>
      {children}
    </Link>
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
  /**
   * 本文に貼られたむき出しの URL のカード。URL をキーに引く。
   *
   * 渡さなければカード化しない (素のリンクのまま描く)。取得は refresh の仕事で、
   * ここでは表に在るものだけを差し替える。
   */
  readonly linkCards?: LinkCardMap;
}

/**
 * MDAST を React 要素に変換して描画する (MDAST → HAST → React)。
 * サーバー側では本文を HTML 化せず MDAST のまま渡し、ここでレンダリングする (ADR 0005)。
 */
export function MdastRenderer({
  node,
  transformImageUrl,
  className,
  linkCards,
}: MdastRendererProps): React.JSX.Element {
  const cardsByUrl = useMemo(
    () => new Map(Object.entries(linkCards ?? {})),
    [linkCards],
  );

  const content = useMemo(() => {
    // カードにするのは、中身が揃っている URL の段落だけ。表に無ければ素のリンクのまま
    // 描く (取れなかったリンクが本文から消えないように)。
    const targets = new Map<Paragraph, string>();
    for (const { paragraph, url } of collectBareLinkParagraphs(node)) {
      if (cardsByUrl.has(url)) targets.set(paragraph, url);
    }

    // allowDangerousHtml で生 HTML を hast へ運べるようにし、実際に何を運ぶかは
    // keepEmbedHtml が選ぶ (既定の挙動どおり、埋め込み以外の生 HTML は捨てる)。
    const hast = toHast(node, {
      allowDangerousHtml: true,
      handlers: { html: keepEmbedHtml, paragraph: linkCardParagraph(targets) },
    }) as HastRoot;
    const transformed = hastProcessor.runSync(expandRawHtml(hast));
    applyElementTransforms(transformed, transformImageUrl);
    wrapMermaidBlocks(transformed);

    return toJsxRuntime(transformed, {
      Fragment,
      jsx,
      jsxs,
      components: {
        pre: CodeBlock,
        img: LightboxImage,
        iframe: Embed,
        a: Anchor,
        [LINK_CARD_TAG]: LinkCardSlot,
        [ALERT_TAG_NAME]: Alert,
        [MERMAID_TAG]: MermaidDiagram,
      },
    }) as React.JSX.Element;
  }, [node, transformImageUrl, cardsByUrl]);

  return (
    <article
      className={`note-prose prose max-w-none ${className ?? ""}`.trim()}
    >
      <LinkCardsContext value={cardsByUrl}>{content}</LinkCardsContext>
    </article>
  );
}
