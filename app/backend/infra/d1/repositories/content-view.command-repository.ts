import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { BatchItem } from "drizzle-orm/batch";
import { legacyArticleId, pointsAt } from "./content-ref-condition";
import type { IContentViewCommandRepository } from "~/backend/domain/content-view";
import type { ContentRef } from "~/backend/domain/shared";
import { articles, contentViews } from "~/backend/infra/d1/schema";
import { scoreWithWeightAdded } from "~/backend/infra/d1/view-log-score";

export class D1ContentViewCommandRepository implements IContentViewCommandRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  /**
   * 累計を 1 増やし、対数スコアにその日の重みを足す。どちらも SQL 側で今の値から作る。
   *
   * 読んでから書き戻す形にはしない。2 手の間に別の閲覧やリアクションが挟まると、
   * 後から書いたほうが先の加算を上書きして消してしまうため。
   *
   * 指す先が無ければ 1 行も当たらず、何も起きない。
   *
   * 旧い列 (`articles.view_count` / `view_log_score`) にも同じ batch で書く (#566)。
   * 片方だけ進んだ姿を残さないため。
   */
  async addView(content: ContentRef, weightLog: number): Promise<void> {
    await this.db.batch([
      this.db
        .update(contentViews)
        .set({
          viewCount: sql`${contentViews.viewCount} + 1`,
          viewLogScore: scoreWithWeightAdded(contentViews.viewLogScore, weightLog),
        })
        .where(pointsAt(contentViews, content)),
      this.addViewToLegacyColumns(legacyArticleId(content), weightLog),
    ]);
  }

  /** 旧い列への書き込み。旧い列を落とすときに消す。 */
  private addViewToLegacyColumns(articleId: string, weightLog: number): BatchItem<"sqlite"> {
    return this.db
      .update(articles)
      .set({
        viewCount: sql`${articles.viewCount} + 1`,
        viewLogScore: scoreWithWeightAdded(articles.viewLogScore, weightLog),
      })
      .where(eq(articles.id, articleId));
  }
}
