import type { Article } from "~/backend/domain/article";
import type { LinkCardMap } from "~/backend/handlers/link-cards/link-card-view";

/** 記事詳細で公開するメタデータ (内部 id は出さない)。 */
export interface PublicArticleMeta {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly imageUrl: string | null;
  readonly publishedOn: string;
  readonly lastModifiedOn: string;
}

/** 詳細レスポンス / ページ props。メタデータ + パース済み MDAST。 */
export interface ArticleDetail {
  readonly article: PublicArticleMeta;
  readonly mdast: unknown;
  /**
   * 本文に貼られたむき出しの URL のカード。URL をキーに引く。
   *
   * 本文 (MDAST) には URL しか無いので、カードの中身は別に渡す。取れていない URL は
   * この表に現れず、描画側は素のリンクのまま描く (ADR 0014)。
   */
  readonly linkCards: LinkCardMap;
}

export function toArticleDetail(
  article: Article,
  mdast: unknown,
  linkCards: LinkCardMap,
): ArticleDetail {
  return {
    article: {
      slug: article.slug.toJSON(),
      title: article.title.toJSON(),
      summary: article.summary,
      imageUrl: article.imageUrl?.toJSON() ?? null,
      publishedOn: article.publishedOn.toString({ calendarName: "never" }),
      lastModifiedOn: article.lastModifiedOn.toString({ calendarName: "never" }),
    },
    mdast,
    linkCards,
  };
}
