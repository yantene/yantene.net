import { drizzle } from "drizzle-orm/d1";
import type { ILinkCardCommandRepository, LinkCard } from "~/backend/domain/link-card";
import { linkCards } from "~/backend/infra/d1/schema";
import { instantToUnix } from "~/backend/infra/d1/temporal";

export class D1LinkCardCommandRepository implements ILinkCardCommandRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  /**
   * カードを書き込む。同じ id (= 同じ URL) の行があれば置き換える。
   *
   * 取り直したときに前の内容が混ざらないよう、部分更新ではなく全列を上書きする。
   * 前は og:image があったのに今は無い、という変化を取りこぼさないため。
   */
  async upsert(card: LinkCard): Promise<void> {
    const metadata = card.metadata;
    const values = {
      id: card.id,
      url: card.url.toString(),
      title: metadata?.title ?? null,
      description: metadata?.description ?? null,
      siteName: metadata?.siteName ?? null,
      // 絵の状態は 2 列に分けて持つ。両方立つ組み合わせをここで作らないこと。
      hasImage: metadata?.image === "stored" ? 1 : 0,
      imageMissed: metadata?.image === "missed" ? 1 : 0,
      hasFavicon: metadata?.hasFavicon === true ? 1 : 0,
      // 失敗が続く間だけ入る。取れたら NULL に戻り、期限は 14 日側へ帰る。
      fetchFailedSince:
        card.fetchFailedSince === undefined ? null : instantToUnix(card.fetchFailedSince),
      imageMissedSince:
        card.imageMissedSince === undefined ? null : instantToUnix(card.imageMissedSince),
      fetchedAt: instantToUnix(card.fetchedAt),
    };

    await this.db
      .insert(linkCards)
      .values(values)
      .onConflictDoUpdate({ target: linkCards.id, set: values });
  }
}
