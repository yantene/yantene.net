import type { ArticleTimelineItemProps } from "./article-timeline-item";

/**
 * `/api/v1/articles` から返る JSON を、タイムラインが扱える形に読み取る。
 *
 * 相手はネットワーク越しの unknown なので、型注釈で押し通さずに 1 つずつ確かめる。
 * 形が違えば null を返し、呼び出し側が読み込み失敗として扱う。
 */
export interface ArticleListPayload {
  readonly articles: readonly ArticleTimelineItemProps[];
  readonly totalPages: number;
}

export function parseArticleListPayload(value: unknown): ArticleListPayload | null {
  if (!isRecord(value)) return null;

  const pagination = value["pagination"];
  if (!isRecord(pagination)) return null;
  const totalPages = pagination["totalPages"];
  if (typeof totalPages !== "number" || !Number.isFinite(totalPages)) {
    return null;
  }

  const rawArticles = value["articles"];
  if (!Array.isArray(rawArticles)) return null;

  const articles: ArticleTimelineItemProps[] = [];
  for (const raw of rawArticles) {
    const article = parseArticle(raw);
    if (article === null) return null;
    articles.push(article);
  }
  return { articles, totalPages };
}

function parseArticle(value: unknown): ArticleTimelineItemProps | null {
  if (!isRecord(value)) return null;

  const { slug, title, summary, imageUrl, publishedOn } = value;
  if (typeof slug !== "string") return null;
  if (typeof title !== "string") return null;
  if (typeof summary !== "string") return null;
  if (typeof publishedOn !== "string") return null;
  // 画像はないこともある。文字列か null 以外は形が違うとみなす。
  if (imageUrl !== null && typeof imageUrl !== "string") return null;
  // タグは 0 個のこともあるが、配列でないなら形が違う。

  return {
    slug,
    title,
    summary,
    imageUrl,
    publishedOn,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
