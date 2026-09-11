import { raw } from "hast-util-raw";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { defaultHandlers, toHast } from "mdast-util-to-hast";
import { useMemo } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import { unified } from "unified";
import { Alert } from "./alert";
import { Anchor } from "./anchor";
import { isArticleAssetSrc } from "./audio";
import { CodeBlock } from "./code-block";
import { normalizeEmbedSrc } from "./embed";
import { DEFAULT_EMBED_TITLE, EmbedFrame } from "./embed-frame";
import { isExternalHref } from "./href";
import { LightboxImage } from "./lightbox-image";
import { LINK_CARD_TAG, LinkCardsContext } from "./link-card-context";
import { LinkCardSlot } from "./link-card-slot";
import { mathMlAttributes, mathMlDescendants, mathMlTagNames } from "./mathml";
import { MermaidDiagram } from "./mermaid-diagram";
import { InlineTableOfContents } from "~/frontend/components/toc/inline-table-of-contents";
import { TOC_TAG, TocHeadingsContext } from "~/frontend/components/toc/toc-context";
import type { Element, ElementContent, Root as HastRoot, RootContent } from "hast";
import type { Html, Paragraph, Root as MdastRoot } from "mdast";
import type { Handler, Raw, State } from "mdast-util-to-hast";
import type { TocHeading } from "~/backend/handlers/articles/toc-headings";
import type { LinkCardMap } from "~/backend/handlers/link-cards/link-card-view";
import { ALERT_TAG_NAME } from "~/backend/services/article-content-parser";
import { withLowercaseScheme } from "~/lib/http-url";
import { collectBareLinkParagraphs } from "~/lib/link-card/bare-link";

/** 見出しを渡さなかったときの既定値。毎回新しい配列を作ると文脈が無駄に揺れる。 */
const EMPTY_HEADINGS: readonly TocHeading[] = [];

/** 図に差し替えるコードブロックを包む、本文には現れない要素名。 */
const MERMAID_TAG = "mermaid-diagram";

/** Mermaid のコードブロックを表すクラス。```mermaid のフェンスから付く。 */
const MERMAID_CLASS = "language-mermaid";

/** 見出しを包むパーマリンクに付けるクラス。`##` の字は CSS が出す。 */
const HEADING_ANCHOR_CLASS = "heading-anchor";

/**
 * パーマリンクを付ける見出し。
 *
 * 目次が拾うのと同じ h2 / h3 に揃える (toc-headings.ts)。h4 以降まで付けると、
 * 節の切れ目ではなく段落の見出しにまで `####` が並んで地の文が読みにくくなる。
 */
const ANCHORED_HEADING_TAGS: ReadonlySet<string> = new Set(["h2", "h3"]);

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
    // 運ぶのは種別 1 つだけ (article-content-parser.ts が引用から起こす)。
    [ALERT_TAG_NAME]: ["kind"],
    ...Object.fromEntries(mathMlTagNames.map((tagName) => [tagName, [...mathMlAttributes]])),
  },
  ancestors: {
    ...defaultSchema.ancestors,
    ...Object.fromEntries(mathMlDescendants.map((tagName) => [tagName, ["math"]])),
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
 * URL のスキームを小文字に揃える。**sanitize より前に通すこと。**
 *
 * hast-util-sanitize は許すスキームを大小を区別する完全一致で照合する
 * (`url.slice(0, protocol.length) === protocol`)。だから `HTTPS://example.com/` は
 * 許可リストに載っていない扱いになり、**href ごと落ちて押せない文字列になる** (#306)。
 * スキームは RFC 3986 で大小を区別しないので、揃えてから渡す。
 */
function lowercaseSchemes(node: HastRoot | RootContent): void {
  if (node.type === "element") {
    const { href, src } = node.properties;
    if (typeof href === "string") {
      node.properties.href = withLowercaseScheme(href);
    }
    if (typeof src === "string") {
      node.properties.src = withLowercaseScheme(src);
    }
  }
  if (!("children" in node)) return;
  for (const child of node.children) lowercaseSchemes(child);
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

/** img 要素: 相対 URL を解決し、遅延読み込み・非同期デコードを既定にする。 */
function transformImage(element: Element, resolve: ((src: string) => string) | undefined): void {
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
function transformAnchor(element: Element, siteOrigin: string | undefined): void {
  element.properties.className = [...toClassList(element.properties.className), "press-control"];

  const href = element.properties.href;
  if (typeof href === "string" && isExternalHref(href, siteOrigin)) {
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
      title: typeof title === "string" && title !== "" ? title : DEFAULT_EMBED_TITLE,
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
    if (typeof src !== "string" || !isArticleAssetSrc(src)) return [];
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
  siteOrigin: string | undefined,
): void {
  if (node.type === "element") {
    if (node.tagName === "img") transformImage(node, resolveImageUrl);
    else if (node.tagName === "a") transformAnchor(node, siteOrigin);
  }
  if ("children" in node) {
    // 埋め込みは形を整えたものに差し替え、通せないものはここで落とす。
    node.children = node.children.flatMap((child) => {
      if (child.type !== "element" || child.tagName !== "iframe") return [child];
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
      applyElementTransforms(child, resolveImageUrl, siteOrigin);
    }
  }
}

/** 要素の下にあるテキストを連結する。コードブロックの中身を取り出すのに使う。 */
function textOf(node: ElementContent): string {
  if (node.type === "text") return node.value;
  if (node.type === "element") return node.children.map((child) => textOf(child)).join("");
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
  if (!toClassList(code.properties.className).includes(MERMAID_CLASS)) return null;

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

/**
 * 見出しの頭に、その見出し自身を指すリンクを差し込む。
 *
 * 押した節の在り処を URL として持ち帰れるようにするためのもので、`##` / `###` の字は
 * CSS が `::before` で出す (mdast-renderer.css)。id は rehype-slug が既に振っている。
 *
 * **見出しを丸ごと包まない。** 包む形にすると、リンクや脚注を含む見出し
 * (`## [foo](...)` や `## 節[^1]`) で a が入れ子になる。HTML の構文解析は入れ子の a を
 * 兄弟に開いてしまうので、サーバーが組んだ木とブラウザが読んだ木が食い違い、
 * hydration ごと落ちる。頭に 1 つ足すだけなら、中身が何であっても形は変わらない。
 *
 * `<a href="#...">` になるので、描画では Anchor が react-router の Link に通す。素の
 * `<a>` のままだと `<ScrollRestoration>` がブラウザのハッシュジャンプを打ち消して
 * スクロールしない (#268 と同じ)。
 *
 * 読み上げには出さない。字を持たないリンクなので名前を与えないと使えないものになるが、
 * 名前を付けたところで見出しごとに「〜へのリンク」が並ぶだけで、見出しそのものを
 * 辿れる支援技術には要らない。焦点も配らない (aria-hidden な要素に焦点が行くと、
 * どこに居るのか分からなくなる)。節を指す URL は目次からも取れる。
 *
 * **applyElementTransforms より後に呼ぶこと。** 先に足すと transformAnchor がこの
 * リンクにも press-control を足し、`##` が押下のたびに沈む。本文のリンクに手応えを
 * 与えるための仕掛けで、行の頭の印に当てるものではない。
 *
 * 見るのは根の直下だけ。目次の抽出 (toc-headings.ts) が同じところしか見ておらず、
 * 引用やリストの中の見出しに独りでにリンクが付くと、目次に出ないものだけが押せる
 * という食い違いになる。
 *
 * sanitize は既に通ったあとで呼ぶ (wrapMermaidBlocks と同じ理由)。足すのはこちらが
 * 見つけた見出しだけなので、本文の生 HTML からこの形を騙って書くことはできない。
 */
function prependHeadingAnchors(tree: HastRoot): void {
  for (const node of tree.children) {
    if (node.type !== "element") continue;
    if (!ANCHORED_HEADING_TAGS.has(node.tagName)) continue;

    const { id } = node.properties;
    // id の無い見出し (rehype-slug は空の見出しに振らない) は行き先が無いので足さない。
    if (typeof id !== "string" || id === "") continue;

    const anchor: Element = {
      type: "element",
      tagName: "a",
      properties: {
        href: `#${id}`,
        className: [HEADING_ANCHOR_CLASS],
        ariaHidden: "true",
        tabIndex: -1,
      },
      children: [],
    };
    node.children = [anchor, ...node.children];
  }
}

/**
 * 本文に目次の差し込み口を空ける。置くのは最初の h2 の直前。
 *
 * リード文 → 目次 → 本編、という順になる。本文の頭に置くと、読み始める前に目次を
 * 読ませることになり、書き出しの一行が目次の下に隠れる。
 *
 * h2 が 1 つも無ければ何もしない。差し込み先が無いというだけでなく、節に割れていない
 * 記事に目次を出しても指せるものが無い。h3 だけで書かれた記事もここでは出ないが、
 * それは目次の要る長さの記事が h2 を使わずに書かれたということで、直すのは本文の側。
 *
 * 見るのは根の直下だけ。引用やリストの中の h2 を数えると、目次が指せない位置
 * (toc-headings.ts が拾わない見出し) に差し込み口が空く。
 *
 * sanitize は既に通ったあとで呼ぶ (wrapMermaidBlocks と同じ)。TOC_TAG を allowlist に
 * 足さずに済むので、本文の生 HTML からこの要素を騙って書くことができない。
 */
function insertInlineToc(tree: HastRoot): void {
  const index = tree.children.findIndex(
    (child) => child.type === "element" && child.tagName === "h2",
  );
  if (index < 0) return;

  const slot: Element = { type: "element", tagName: TOC_TAG, properties: {}, children: [] };
  tree.children = tree.children.toSpliced(index, 0, slot);
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
  /**
   * 本文に差し込む目次の見出し (サーバー側で抽出したもの)。
   *
   * 渡さなければ差し込まない。右カラムに目次を出せる幅では、本文の中にもう 1 つ置く
   * 必要が無いので、出し分けは CSS が持つ (inline-table-of-contents.css)。
   *
   * リンクカードと同じく、hast に運べるのは印だけなので中身は文脈に載せる。描画の
   * 途中に React の要素を差し込むには hast の段で位置を決めるしかなく、その位置を
   * 知っているのはここだけ。
   */
  readonly headings?: readonly TocHeading[];
  /**
   * このサイトの出どころ (`https://yantene.net` 等)。
   *
   * 本文に絶対 URL で書かれた自分のサイトへのリンクを、内部として扱うために使う。
   * **渡さなければ絶対 URL はすべて外部** (別タブ + `rel`) になる (#318)。
   */
  readonly siteOrigin?: string;
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
  headings,
  siteOrigin,
}: MdastRendererProps): React.JSX.Element {
  const cardsByUrl = useMemo(() => new Map(Object.entries(linkCards ?? {})), [linkCards]);

  /*
   * 差し込むかどうかだけを取り出しておく。見出しの列そのものを木の組み直しの依存に
   * すると、loader が毎回作り直す配列で本文が丸ごと組み直される。中身は文脈で渡すので、
   * 木のほうが知る必要があるのは「差し込み口を空けるか」の一点しかない。
   */
  const hasToc = (headings?.length ?? 0) > 0;

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
    const expanded = expandRawHtml(hast);
    // sanitize がスキームを大小を区別して照合するので、その手前で揃える (#306)。
    lowercaseSchemes(expanded);
    const transformed = hastProcessor.runSync(expanded);
    applyElementTransforms(transformed, transformImageUrl, siteOrigin);
    wrapMermaidBlocks(transformed);
    prependHeadingAnchors(transformed);
    /*
     * 差し込み口は見出しに印を足した後に空ける。どちらも根の直下しか見ないので順に
     * 依存は無いが、目次の印を数えないで済むぶん、この順のほうが読みやすい。
     */
    if (hasToc) insertInlineToc(transformed);

    return toJsxRuntime(transformed, {
      Fragment,
      jsx,
      jsxs,
      components: {
        pre: CodeBlock,
        img: LightboxImage,
        iframe: EmbedFrame,
        a: Anchor,
        [LINK_CARD_TAG]: LinkCardSlot,
        [ALERT_TAG_NAME]: Alert,
        [MERMAID_TAG]: MermaidDiagram,
        [TOC_TAG]: InlineTableOfContents,
      },
    }) as React.JSX.Element;
  }, [node, transformImageUrl, cardsByUrl, hasToc, siteOrigin]);

  return (
    <article className={`mdast-prose prose max-w-none ${className ?? ""}`.trim()}>
      <LinkCardsContext value={cardsByUrl}>
        <TocHeadingsContext value={headings ?? EMPTY_HEADINGS}>{content}</TocHeadingsContext>
      </LinkCardsContext>
    </article>
  );
}
