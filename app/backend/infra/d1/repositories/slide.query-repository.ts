import type { ISlideQueryRepository, Slide, SlideSlug } from "~/backend/domain/slide";
import { asc, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { rowToSlide } from "./slide-row";
import { slides } from "~/backend/infra/d1/schema";

export class D1SlideQueryRepository implements ISlideQueryRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  /**
   * 全件を出した日の新しい順で返す。
   *
   * 第 2 キーに slug を置くのは、同じ日に 2 本出したときに並びが揺れないようにするため。
   * `published_on` は `YYYY-MM-DD` の字なので、字の順がそのまま日付の順になる。
   */
  async list(): Promise<readonly Slide[]> {
    const rows = await this.db
      .select()
      .from(slides)
      .orderBy(desc(slides.publishedOn), asc(slides.slug));
    return rows.map((row) => rowToSlide(row));
  }

  async findBySlug(slug: SlideSlug): Promise<Slide | undefined> {
    const [row] = await this.db
      .select()
      .from(slides)
      .where(eq(slides.slug, slug.toString()))
      .limit(1);
    return row === undefined ? undefined : rowToSlide(row);
  }

  async listSourceHashes(): Promise<ReadonlyMap<string, string>> {
    const rows = await this.db
      .select({ slug: slides.slug, sourceHash: slides.sourceHash })
      .from(slides);
    return new Map(rows.map((row) => [row.slug, row.sourceHash]));
  }
}
