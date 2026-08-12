import { drizzle } from "drizzle-orm/d1";
import type {
  ILinkCardCommandRepository,
  LinkCard,
} from "~/backend/domain/link-card";
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
      hasImage: metadata?.hasImage === true ? 1 : 0,
      hasFavicon: metadata?.hasFavicon === true ? 1 : 0,
      fetchedAt: instantToUnix(card.fetchedAt),
    };

    await this.db
      .insert(linkCards)
      .values(values)
      .onConflictDoUpdate({ target: linkCards.id, set: values });
  }
}
