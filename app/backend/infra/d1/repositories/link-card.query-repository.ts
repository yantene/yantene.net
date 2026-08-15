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
   * 期限は取得のされ方で 3 通りある。「取れているか」を表しているのは title が NULL か
   * どうか、「絵を取り逃したか」を表しているのは image_missed なので、その対応付けは
   * この層が持つ。期限そのものの値はドメインが決めて渡してくる。
   *
   * 3 つの条件は重ならないように書く。取り逃したカードを取得できたカードの側でも
   * 拾えてしまうと、期限の大小を変えたときに黙って長いほうが効く。
   */
  async listStale(query: StaleLinkCardQuery): Promise<readonly LinkCard[]> {
    const availableBefore = instantToUnix(query.available);
    const unavailableBefore = instantToUnix(query.unavailable);
    const imageMissedBefore = instantToUnix(query.imageMissed);
    const staleWhenAvailable = and(
      isNotNull(linkCards.title),
      eq(linkCards.imageMissed, 0),
      lt(linkCards.fetchedAt, availableBefore),
    );
    const staleWhenImageMissed = and(
      isNotNull(linkCards.title),
      eq(linkCards.imageMissed, 1),
      lt(linkCards.fetchedAt, imageMissedBefore),
    );
    const staleWhenUnavailable = and(
      isNull(linkCards.title),
      lt(linkCards.fetchedAt, unavailableBefore),
    );

    const rows = await this.db
      .select()
      .from(linkCards)
      .where(or(staleWhenAvailable, staleWhenImageMissed, staleWhenUnavailable))
      .orderBy(asc(linkCards.fetchedAt))
      .limit(query.limit);

    return rows.map((row) => toLinkCard(row));
  }
}
