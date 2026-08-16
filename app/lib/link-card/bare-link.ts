import { toString as mdastToString } from "mdast-util-to-string";
import type { Link, Nodes, Paragraph, Root } from "mdast";
import { isHttpUrl } from "~/lib/http-url";

/**
 * 本文中の「むき出しの URL だけの段落」を見つける。
 *
 * カードにしてよい**場所**かどうかの判断はここ 1 つに集める。取得側 (refresh) と描画側
 * (MdastRenderer) が別々に判定すると、片方だけカードになる・ならないという食い違いが
 * 静かに起きる。同じ木を同じ関数で見る。
 *
 * URL として載せてよいかは `~/lib/http-url` の isHttpUrl が答える。描画側の落とし所
 * (link-card-slot.tsx) も同じ関数を通るので、こちらとあちらで答えが割れない。
 */

/**
 * カードにしない入れ物。
 *
 * - listItem: リストは参照の列挙であることが多く、項目ごとにカードが挟まると並びが
 *   読めなくなる (remark-link-card-plus が分けた線引きと同じ)
 * - footnoteDefinition: 脚注も同じく参照の列挙で、本文の脇に小さく置く前提の場所
 */
const cardBlockingAncestors: ReadonlySet<Nodes["type"]> = new Set([
  "listItem",
  "footnoteDefinition",
]);

/** 空白だけの text ノードか。段落の前後に挟まる空白で「子は 1 つ」の判定が崩れないようにする。 */
function isBlankText(node: Nodes): boolean {
  return node.type === "text" && node.value.trim().length === 0;
}

/**
 * リンクのテキストが URL そのものか。
 *
 * GFM の autolink literal は `www.example.com` のようにスキームを省いた書き方も拾い、
 * その場合 url にだけ `http://` が足される。書き手はむき出しの URL を置いたつもりなので、
 * この足された分は同じものとして扱う。
 */
function isBare(link: Link): boolean {
  const text = mdastToString(link).trim();
  if (text.length === 0) return false;
  return [text, `http://${text}`, `https://${text}`].includes(link.url);
}

/** 段落がむき出しの URL 1 つだけでできているなら、その URL を返す。 */
function bareLinkUrlOf(paragraph: Paragraph): string | undefined {
  const children = paragraph.children.filter((child) => !isBlankText(child));
  if (children.length !== 1) return undefined;

  const [only] = children;
  if (only.type !== "link") return undefined;
  // カードにできるのは http(s) だけ (相対 URL や mailto: は対象外)。
  if (!isBare(only) || !isHttpUrl(only.url)) return undefined;
  return only.url;
}

/** カード化する段落と、その URL の組。 */
export interface BareLinkParagraph {
  readonly paragraph: Paragraph;
  readonly url: string;
}

/**
 * 木を走査してカード化する段落を集める。
 *
 * 段落そのもの (ノードの同一性) を返すのは、描画側が「この段落をカードに差し替える」を
 * 位置ではなく参照で決められるようにするため。
 */
export function collectBareLinkParagraphs(
  root: Root,
): readonly BareLinkParagraph[] {
  const found: BareLinkParagraph[] = [];

  function walk(node: Nodes, isBlocked: boolean): void {
    if (node.type === "paragraph" && !isBlocked) {
      const url = bareLinkUrlOf(node);
      if (url !== undefined) {
        found.push({ paragraph: node, url });
        return; // 段落の中にさらに段落は無い
      }
    }
    if (!("children" in node)) return;
    const isChildBlocked = isBlocked || cardBlockingAncestors.has(node.type);
    for (const child of node.children) walk(child, isChildBlocked);
  }

  walk(root, false);
  return found;
}

/** カード化する URL を重複なく集める (定義順は保つ)。 */
export function collectBareLinkUrls(root: Root): readonly string[] {
  const seen = new Set<string>();
  for (const { url } of collectBareLinkParagraphs(root)) seen.add(url);
  return [...seen];
}
