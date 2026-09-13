import type { IWorkQueryRepository, Work, WorkSlug } from "~/backend/domain/work";
import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { rowToWork } from "./work-row";
import { works } from "~/backend/infra/d1/schema";

export class D1WorkQueryRepository implements IWorkQueryRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  /**
   * 全件を並び順で返す。
   *
   * 第 2 キーに slug を置くのは、同じ `position` を 2 つ書いたときに並びが揺れない
   * ようにするため。書き手の誤りではあるが、refresh のたびに順が入れ替わるより、
   * 決まった順で出続けるほうが気づきやすい。
   */
  async list(): Promise<readonly Work[]> {
    const rows = await this.db.select().from(works).orderBy(asc(works.position), asc(works.slug));
    return rows.map(rowToWork);
  }

  async findBySlug(slug: WorkSlug): Promise<Work | undefined> {
    const [row] = await this.db
      .select()
      .from(works)
      .where(eq(works.slug, slug.toString()))
      .limit(1);
    return row === undefined ? undefined : rowToWork(row);
  }

  async listSourceHashes(): Promise<ReadonlyMap<string, string>> {
    const rows = await this.db
      .select({ slug: works.slug, sourceHash: works.sourceHash })
      .from(works);
    return new Map(rows.map((row) => [row.slug, row.sourceHash]));
  }
}
