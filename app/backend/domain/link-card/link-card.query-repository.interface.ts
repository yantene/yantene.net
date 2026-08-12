import type { LinkCardUrl } from "./link-card-url.vo";
import type { LinkCard } from "./link-card.entity";
import type { Temporal } from "@js-temporal/polyfill";

/** 期限切れを絞り込むための境目。値の決め方はドメイン (staleCutoffs) が持つ。 */
export interface StaleLinkCardQuery {
  /** 取得できているカードは、この時刻より前に取ったものが古い。 */
  readonly available: Temporal.Instant;
  /** 取得できなかったカードは、この時刻より前に試したものが古い。 */
  readonly unavailable: Temporal.Instant;
  readonly limit: number;
}

export interface ILinkCardQueryRepository {
  /**
   * URL でカードを引く。見つからないものは結果に現れない。
   *
   * 記事 1 本に貼られたリンクをまとめて引くので、URL の配列で受ける。
   */
  findByUrls(urls: readonly LinkCardUrl[]): Promise<readonly LinkCard[]>;

  /** 取り直すべきカードを古い順に返す。 */
  listStale(query: StaleLinkCardQuery): Promise<readonly LinkCard[]>;
}
