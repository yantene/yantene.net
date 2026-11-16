import { articleSlugOfHref } from "./href";
import type { Element, ElementContent, Root as HastRoot, RootContent } from "hast";

/** 脚注の参照を表す、本文には現れない要素名。描くのは FootnoteReference。 */
export const FOOTNOTE_REFERENCE_TAG = "footnote-reference";

/** このサイトの記事へのリンクを表す、本文には現れない要素名。描くのは ArticleLink。 */
export const ARTICLE_LINK_TAG = "article-link";

/** 脚注の参照か。toHast が `<sup>` の中の `<a>` に `data-footnote-ref` を付けて出す。 */
function isFootnoteReference(element: Element): boolean {
  return element.tagName === "a" && element.properties.dataFootnoteRef !== undefined;
}

/** 脚注から本文へ戻る矢印か。 */
function isFootnoteBackReference(node: ElementContent): boolean {
  return (
    node.type === "element" &&
    node.tagName === "a" &&
    node.properties.dataFootnoteBackref !== undefined
  );
}

/** リンクを、プレビューを出す印つきの要素に付け替える。当たらなければそのまま返す。 */
function toPreviewAnchor(element: Element, siteOrigin: string | undefined): Element {
  if (element.tagName !== "a") return element;
  if (isFootnoteReference(element)) return { ...element, tagName: FOOTNOTE_REFERENCE_TAG };

  const { href } = element.properties;
  const slug = typeof href === "string" ? articleSlugOfHref(href, siteOrigin) : null;
  if (slug === null) return element;
  return {
    ...element,
    tagName: ARTICLE_LINK_TAG,
    properties: { ...element.properties, slug },
  };
}

/**
 * プレビューを出すリンク (脚注の参照と、このサイトの記事へのリンク) に印を付ける。
 *
 * 変えるのは要素名だけで、属性も中身もそのまま運ぶ。描く側 (FootnoteReference /
 * ArticleLink) は、何も起きていない間は今までと同じ `<a>` を出す。
 *
 * **戻りの矢印 (`data-footnote-backref`) には付けない。** 行き先は本文の中の参照で、
 * 予告するものが無い。
 *
 * sanitize は既に通ったあとで呼ぶ (wrapMermaidBlocks と同じ理由)。印の要素名を
 * allowlist に足さずに済むので、本文の生 HTML からこの要素を騙って書くことができない。
 */
export function markPreviewAnchors(
  node: HastRoot | RootContent,
  siteOrigin: string | undefined,
): void {
  if (!("children" in node)) return;

  node.children = node.children.map((child) =>
    child.type === "element" ? toPreviewAnchor(child, siteOrigin) : child,
  );
  for (const child of node.children) markPreviewAnchors(child, siteOrigin);
}

/** 末尾の空白だけの文字を落とす。戻りの矢印を外した跡に、その手前の空白が残るため。 */
function trimTrailingWhitespace(children: readonly ElementContent[]): ElementContent[] {
  const last = children.at(-1);
  if (last?.type !== "text") return [...children];

  const value = last.value.trimEnd();
  return value === "" ? children.slice(0, -1) : [...children.slice(0, -1), { ...last, value }];
}

/**
 * 脚注の中身を、チップとドロワーに出す形へ写す。
 *
 * - **戻りの矢印を外す。** チップは参照のすぐ脇に出ているので、戻る先が無い
 * - **id を外す。** 末尾の脚注一覧に同じ id が居るので、写しが出ている間だけ重複する。
 *   重複すると `#...` で飛ぶ先がどちらになるか決まらない
 */
function toFootnoteBody(node: ElementContent): ElementContent[] {
  if (isFootnoteBackReference(node)) return [];
  if (node.type !== "element") return [node];

  const { id: _id, ...properties } = node.properties;
  const children = node.children.flatMap((child) => toFootnoteBody(child));
  return [{ ...node, properties, children: trimTrailingWhitespace(children) }];
}

/** 木の中から、脚注の一覧 (`<section data-footnotes>`) を探す。toHast は根の末尾に置く。 */
function findFootnoteSection(tree: HastRoot): Element | undefined {
  return tree.children.find(
    (child): child is Element =>
      child.type === "element" &&
      child.tagName === "section" &&
      child.properties.dataFootnotes !== undefined,
  );
}

/** 脚注の一覧の項目 (`<li id="user-content-fn-1">`)。 */
function footnoteItemsOf(section: Element): readonly Element[] {
  return section.children
    .filter((child): child is Element => child.type === "element" && child.tagName === "ol")
    .flatMap((list) => list.children)
    .filter((child): child is Element => child.type === "element" && child.tagName === "li");
}

/**
 * 脚注の中身を、id をキーに取り出す。キーは参照の `href` から `#` を除いたもの。
 *
 * **MDAST の `footnoteDefinition` を組み直すのではなく、組み終えた木から写す。**
 * 末尾の脚注一覧は、同じ `footnoteDefinition` から toHast が起こし、本文と同じ変換
 * (sanitize・リンクの付け替え・画像の解決・数式) を通り終えたもの。ここから写せば、
 * チップの中身は本文と同じ描き方に必ず揃う。別に組み直すと、変換を足したときに
 * 片方だけ古びる。
 *
 * **変換をすべて終えたあとで呼ぶこと。** 先に呼ぶと、後から足した変換が写しに乗らない。
 */
export function collectFootnoteBodies(tree: HastRoot): ReadonlyMap<string, HastRoot> {
  const section = findFootnoteSection(tree);
  if (section === undefined) return new Map();

  return new Map(
    footnoteItemsOf(section).flatMap((item) => {
      const { id } = item.properties;
      if (typeof id !== "string" || id === "") return [];
      const children = item.children.flatMap((child) => toFootnoteBody(child));
      return [[id, { type: "root", children } satisfies HastRoot] as const];
    }),
  );
}
