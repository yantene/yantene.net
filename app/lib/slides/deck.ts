import { toString as mdastToString } from "mdast-util-to-string";
import type {
  Definition,
  FootnoteDefinition,
  Image,
  List,
  Paragraph,
  PhrasingContent,
  Root,
  RootContent,
} from "mdast";

/*
 * スライドの原文 (記事と同じ MDAST) をページに切り、意味の語彙に当てる (ADR 0052)。
 *
 * **原文に書いてよいのは意味だけ。** 配置・大きさ・色・トランジションの指定は持たない。
 * どのページにどう置くかは、ここが意味と中身の形から決める。同じ原文からは必ず同じ
 * デッキができる (時計も乱数も読まない)。
 *
 * | Markdown             | スライドでの姿                                         |
 * | -------------------- | ------------------------------------------------------ |
 * | `#`                  | 章の扉                                                 |
 * | `##`                 | 1 ページ。見出しがページの題                           |
 * | 地の文の段落         | 語り (発表者ノート)。スライドには出ない                |
 * | `-` のリスト         | 箇条書き                                               |
 * | `1.` のリスト        | 1 項目ずつ出す                                         |
 * | 画像だけの段落       | 図。置き方は縦横比で決まる                             |
 * | 表・引用・Alert・コード・数式 | そのまま 1 つの塊                             |
 * | 脚注の定義           | 最後の References のページ                             |
 * | `. . .`              | 間。ここで一度止める                                   |
 *
 * サーバー (同期のときの量の検査、ページの loader) とブラウザの両方から呼ぶので、
 * `app/lib/` に置く。
 */

/**
 * ページの置き方。**書き手は選べない** (中身の形から決まる)。
 *
 * - `statement`: 題だけ。一言のページ
 * - `figure`: 題と図 1 つだけ。図を全面に
 * - `figure-over`: 横長の図と、ほかの塊。上下に積む
 * - `figure-beside`: 縦長の図と、ほかの塊。左右に並べる
 * - `quote`: 引用だけ。引用を大きく
 * - `table`: 表だけ。表を中央に
 * - `body`: それ以外。上から順に並べる
 */
export type SlideLayout =
  | "statement"
  | "figure"
  | "figure-over"
  | "figure-beside"
  | "quote"
  | "table"
  | "body";

/** ページに置く塊 1 つ。 */
export interface SlideBlock {
  readonly node: RootContent;
  /** この塊が出る段。0 はページを開いたときから見えている。 */
  readonly step: number;
  /**
   * 番号付きリストのときだけ、項目ごとの段 (項目の数だけ並ぶ)。
   * 順序のあるものは順に語るので、1 項目ずつ出す。
   */
  readonly itemSteps?: readonly number[];
}

export interface CoverPage {
  readonly kind: "cover";
  /** 最初の見出しより前に書いた地の文。表紙で話すこと。 */
  readonly notes: readonly RootContent[];
}

export interface ChapterPage {
  readonly kind: "chapter";
  readonly title: readonly PhrasingContent[];
  /** 何番目の章か (1 始まり)。 */
  readonly chapter: number;
  readonly notes: readonly RootContent[];
}

export interface ContentPage {
  readonly kind: "content";
  /** ページの題。最初の見出しより前に塊を書いたときだけ空になる。 */
  readonly title: readonly PhrasingContent[];
  /** 属している章 (1 始まり)。章を切っていないデッキでは 0。 */
  readonly chapter: number;
  readonly layout: SlideLayout;
  /** 置き方が図を別に扱うとき (`figure` / `figure-over` / `figure-beside`) の図。 */
  readonly figure: SlideBlock | null;
  /** 図を除いた塊。書いた順。 */
  readonly blocks: readonly SlideBlock[];
  /** 最後の段の番号。0 なら止まるところが無い。 */
  readonly lastStep: number;
  readonly notes: readonly RootContent[];
}

export interface ReferencesPage {
  readonly kind: "references";
  readonly footnotes: readonly FootnoteDefinition[];
}

export type SlidePage = CoverPage | ChapterPage | ContentPage | ReferencesPage;

export interface SlideDeck {
  readonly pages: readonly SlidePage[];
  /** 章の数。扉が「全体の中の位置」を出すのに使う。 */
  readonly chapters: number;
  /**
   * リンクの参照定義 (`[名前]: URL`)。ページごとに描くとき、参照が切れないよう
   * どのページにも添える。
   */
  readonly definitions: readonly Definition[];
}

/** 横長とみなす縦横比 (幅 ÷ 高さ) の下限。これ未満は縦長として左右に並べる。 */
const LANDSCAPE_RATIO = 1.2;

/** 「間」の印。Pandoc と同じ書き方。 */
const PAUSE_PATTERN = /^\.\s\.\s\.$/;

/** 組み立て途中のページ。 */
interface Draft {
  readonly kind: "cover" | "chapter" | "content";
  readonly title: readonly PhrasingContent[];
  readonly chapter: number;
  readonly blocks: SlideBlock[];
  readonly notes: RootContent[];
  step: number;
}

/**
 * MDAST をデッキに切る。
 *
 * 表紙は必ず 1 枚目に立つ (題と発表の場はフロントマターが持つので、ここでは殻だけ)。
 * 脚注があれば、最後に References のページを 1 枚足す。
 */
export function paginate(mdast: Root): SlideDeck {
  const drafts: Draft[] = [draft("cover", [], 0)];
  const footnotes: FootnoteDefinition[] = [];
  const definitions: Definition[] = [];
  let chapters = 0;

  for (const node of mdast.children) {
    const current = drafts.at(-1) ?? draft("cover", [], 0);
    if (node.type === "heading" && node.depth === 1) {
      chapters += 1;
      drafts.push(draft("chapter", node.children, chapters));
    } else if (node.type === "heading" && node.depth === 2) {
      drafts.push(draft("content", node.children, chapters));
    } else if (node.type === "footnoteDefinition") {
      footnotes.push(node);
    } else if (node.type === "definition") {
      definitions.push(node);
    } else {
      place(node, current, drafts);
    }
  }

  return {
    pages: [
      ...drafts.map((each) => finish(each)),
      ...(footnotes.length === 0 ? [] : [{ kind: "references" as const, footnotes }]),
    ],
    chapters,
    definitions,
  };
}

function draft(kind: Draft["kind"], title: readonly PhrasingContent[], chapter: number): Draft {
  return { kind, title, chapter, blocks: [], notes: [], step: 0 };
}

/**
 * 見出しでも定義でもないノードを、いまのページに置く。
 *
 * 表紙と章の扉は塊を持てない。そこに塊を書いたら、題の無いページを 1 枚起こして載せる
 * (捨てない。書いたものが黙って消えるほうが困る)。
 */
function place(node: RootContent, current: Draft, drafts: Draft[]): void {
  if (isNarration(node)) {
    current.notes.push(node);
    return;
  }
  // 生の HTML は見た目の逃げ道になるので運ばない。区切り線はページを切らない (切るのは見出し)。
  if (node.type === "html" || node.type === "thematicBreak") return;

  if (isPause(node)) {
    // 間は、塊の置けるページの中でだけ意味を持つ。表紙や扉の直後に書いた間でページを起こさない。
    if (current.kind === "content") current.step += 1;
    return;
  }

  const page = current.kind === "content" ? current : draft("content", [], current.chapter);
  if (page !== current) drafts.push(page);
  page.blocks.push(blockOf(node, page));
}

/** 塊にし、番号付きリストなら項目ごとに段を進める。 */
function blockOf(node: RootContent, page: Draft): SlideBlock {
  if (!isOrderedList(node)) return { node, step: page.step };

  const first = page.step;
  const itemSteps = node.children.map((_, index) => first + index);
  page.step = itemSteps.at(-1) ?? first;
  return { node, step: first, itemSteps };
}

function finish(page: Draft): SlidePage {
  if (page.kind === "cover") return { kind: "cover", notes: page.notes };
  if (page.kind === "chapter") {
    return { kind: "chapter", title: page.title, chapter: page.chapter, notes: page.notes };
  }

  const figures = page.blocks.filter((block) => isFigure(block.node));
  const figure = figures.length === 1 ? (figures[0] ?? null) : null;
  const blocks = figure === null ? page.blocks : page.blocks.filter((block) => block !== figure);
  return {
    kind: "content",
    title: page.title,
    chapter: page.chapter,
    layout: layoutOf(figure, blocks),
    figure,
    blocks,
    // 最後の塊が出る段まで。ページの末尾に書いた間で、何も出ない空送りを作らない。
    lastStep: Math.max(0, ...page.blocks.map((block) => block.itemSteps?.at(-1) ?? block.step)),
    notes: page.notes,
  };
}

/**
 * 置き方を決める。図が 1 つのときは図を主役にし、ほかの塊との並べ方を縦横比で決める。
 * 図が 2 つ以上あるときは特別扱いしない (上から順に並べる)。
 */
function layoutOf(figure: SlideBlock | null, blocks: readonly SlideBlock[]): SlideLayout {
  if (figure !== null) {
    if (blocks.length === 0) return "figure";
    return isLandscape(figure.node) ? "figure-over" : "figure-beside";
  }
  if (blocks.length === 0) return "statement";

  const only = blocks.length === 1 ? blocks[0]?.node : undefined;
  if (only?.type === "blockquote" && !isAlert(only)) return "quote";
  if (only?.type === "table") return "table";
  return "body";
}

/** 地の文の段落。図だけの段落と「間」は語りではない。 */
function isNarration(node: RootContent): node is Paragraph {
  return node.type === "paragraph" && !isFigure(node) && !isPause(node);
}

function isPause(node: RootContent): boolean {
  return node.type === "paragraph" && PAUSE_PATTERN.test(mdastToString(node).trim());
}

/** 画像 1 つだけでできた段落。 */
function isFigure(node: RootContent): node is Paragraph {
  return node.type === "paragraph" && imageOf(node) !== undefined;
}

/** 図の段落から画像を取り出す。画像のほかに字があれば図ではない。 */
export function imageOf(node: Paragraph): Image | undefined {
  const meaningful = node.children.filter(
    (child) => !(child.type === "text" && child.value.trim() === ""),
  );
  const only = meaningful.length === 1 ? meaningful[0] : undefined;
  return only?.type === "image" ? only : undefined;
}

function isOrderedList(node: RootContent): node is List {
  return node.type === "list" && node.ordered === true;
}

/** Alert (`> [!NOTE]`) は引用から組んだ別の塊。大きな引用としては扱わない。 */
function isAlert(node: RootContent): boolean {
  return node.data !== undefined && "hName" in node.data;
}

/**
 * 横長の図か。寸法は同期のときに画像へ埋めてある (記事の画像と同じ処理)。
 * 読めなかった画像は横長として扱う (上下に積むほうが、どんな図でも収まりやすい)。
 */
function isLandscape(node: RootContent): boolean {
  if (node.type !== "paragraph") return true;
  const properties: unknown = imageOf(node)?.data?.hProperties;
  if (typeof properties !== "object" || properties === null) return true;

  const { width, height } = properties as { width?: unknown; height?: unknown };
  if (typeof width !== "number" || typeof height !== "number" || height <= 0) return true;
  return width / height >= LANDSCAPE_RATIO;
}

/** ページの題を素の字にする。一覧や `<title>`、読み上げ用。 */
export function titleTextOf(page: SlidePage): string {
  if (page.kind === "cover" || page.kind === "references") return "";
  return mdastToString({ type: "paragraph", children: [...page.title] });
}

/**
 * 「間」の印 (`. . .`) を除いた原文。読み物として描くときに使う。
 *
 * 間はスライドの時間の話で、上から下へ読む文章には意味が無い。残すと `. . .` が
 * 字としてそのまま出る。
 */
export function withoutPauses(mdast: Root): Root {
  return { ...mdast, children: mdast.children.filter((node) => !isPause(node)) };
}

/**
 * 脚注の番号。References のページに並ぶ順 (定義を書いた順) で 1 から振る。
 * スライドの中の参照を、リンクではなく番号だけで出すために使う。
 */
export function footnoteNumbers(deck: SlideDeck): ReadonlyMap<string, number> {
  const references = deck.pages.find((page) => page.kind === "references");
  const footnotes = references?.kind === "references" ? references.footnotes : [];
  return new Map(footnotes.map((footnote, index) => [footnote.identifier, index + 1]));
}
