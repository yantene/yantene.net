import { and, asc, eq, inArray, isNotNull, isNull, lt, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { toLinkCard } from "./link-card-row";
import type {
  ILinkCardQueryRepository,
  LinkCard,
  LinkCardUrl,
  StaleLinkCardQuery,
} from "~/backend/domain/link-card";
import { linkCards } from "~/backend/infra/d1/schema";
import { instantToUnix } from "~/backend/infra/d1/temporal";

export class D1LinkCardQueryRepository implements ILinkCardQueryRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  async findByUrls(urls: readonly LinkCardUrl[]): Promise<readonly LinkCard[]> {
    // 空で問い合わせると `IN ()` になり SQL として成立しない。手前で切る。
    if (urls.length === 0) return [];

    const rows = await this.db
      .select()
      .from(linkCards)
      .where(
        inArray(
          linkCards.url,
          urls.map((url) => url.toString()),
        ),
      );

    return rows.map((row) => toLinkCard(row));
  }

  /**
   * 取り直すべきカードを古い順に返す。
   *
   * 期限は取得のされ方で 4 通りある。**それを表しているのは title と fetch_failed_since
   * と image_missed の組で、対応付けはこの層が持つ** (行の読み方は link-card-row.ts の
   * 表を参照)。期限そのものの値はドメインが決めて渡してくる。
   *
   * 条件は重ならないように書く。取り逃したカードを取得できたカードの側でも拾えて
   * しまうと、期限の大小を変えたときに黙って長いほうが効く。
   */
  async listStale(query: StaleLinkCardQuery): Promise<readonly LinkCard[]> {
    const availableBefore = instantToUnix(query.available);
    const unavailableBefore = instantToUnix(query.unavailable);
    const imageMissedBefore = instantToUnix(query.imageMissed);
    const keptAfterFailureBefore = instantToUnix(query.keptAfterFailure);
    const staleWhenAvailable = and(
      isNotNull(linkCards.title),
      isNull(linkCards.fetchFailedSince),
      eq(linkCards.imageMissed, 0),
      lt(linkCards.fetchedAt, availableBefore),
    );
    const staleWhenImageMissed = and(
      isNotNull(linkCards.title),
      isNull(linkCards.fetchFailedSince),
      eq(linkCards.imageMissed, 1),
      lt(linkCards.fetchedAt, imageMissedBefore),
    );
    // 中身は在るが直近の取得は失敗した行。見せるものはあるので、短い側の間隔で試す。
    // image_missed は見ない。持ちこたえている間はどちらでも同じ間隔でよい。
    const staleWhenKeptAfterFailure = and(
      isNotNull(linkCards.title),
      isNotNull(linkCards.fetchFailedSince),
      lt(linkCards.fetchedAt, keptAfterFailureBefore),
    );
    const staleWhenUnavailable = and(
      isNull(linkCards.title),
      lt(linkCards.fetchedAt, unavailableBefore),
    );

    const rows = await this.db
      .select()
      .from(linkCards)
      .where(
        or(
          staleWhenAvailable,
          staleWhenImageMissed,
          staleWhenKeptAfterFailure,
          staleWhenUnavailable,
        ),
      )
      .orderBy(asc(linkCards.fetchedAt))
      .limit(query.limit);

    return rows.map((row) => toLinkCard(row));
  }
}
