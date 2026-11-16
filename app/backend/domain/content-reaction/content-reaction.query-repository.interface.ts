import type { ContentRef } from "~/backend/domain/shared";

/** コンテンツに付いている絵文字とその数。 */
export interface ContentReactionCount {
  readonly emoji: string;
  readonly count: number;
}

export interface IContentReactionQueryRepository {
  /**
   * コンテンツ 1 つに付いているリアクションを、多い順に返す。
   *
   * 0 の行は返さない。取り消しで 0 になった絵文字を並べても意味がないため。
   */
  listByContent(content: ContentRef): Promise<readonly ContentReactionCount[]>;
}
