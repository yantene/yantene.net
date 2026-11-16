import type { IWorkQueryRepository, Work, WorkSlug } from "~/backend/domain/work";
import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { rowToWork } from "./work-row";
import { workArticles, workScreenshots, works } from "~/backend/infra/d1/schema";

/** `key` ごとに束ねる。束の中の順は入力の順のまま。 */
function groupBy<T>(rows: readonly T[], keyOf: (row: T) => string): ReadonlyMap<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const group = groups.get(keyOf(row)) ?? [];
    group.push(row);
    groups.set(keyOf(row), group);
  }
  return groups;
}

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
   *
   * 子の行は**全件を引いてから束ねる**。作品の id を `IN (...)` に並べると、作品が
   * 増えたときに D1 のバインドパラメータ上限 (100) を踏む。子の行は作品の数 × 十数件
   * までなので、絞らずに引いても軽い。
   */
  async list(): Promise<readonly Work[]> {
    const [rows, screenshots, articles] = await Promise.all([
      this.db.select().from(works).orderBy(asc(works.position), asc(works.slug)),
      this.db
        .select()
        .from(workScreenshots)
        .orderBy(asc(workScreenshots.workId), asc(workScreenshots.position)),
      this.db
        .select()
        .from(workArticles)
        .orderBy(asc(workArticles.workId), asc(workArticles.position)),
    ]);
    const screenshotsByWork = groupBy(screenshots, (row) => row.workId);
    const articlesByWork = groupBy(articles, (row) => row.workId);

    return rows.map((row) =>
      rowToWork(row, {
        screenshots: screenshotsByWork.get(row.id) ?? [],
        articles: articlesByWork.get(row.id) ?? [],
      }),
    );
  }

  async findBySlug(slug: WorkSlug): Promise<Work | undefined> {
    const [row] = await this.db
      .select()
      .from(works)
      .where(eq(works.slug, slug.toString()))
      .limit(1);
    if (row === undefined) return undefined;

    const [screenshots, articles] = await Promise.all([
      this.db
        .select()
        .from(workScreenshots)
        .where(eq(workScreenshots.workId, row.id))
        .orderBy(asc(workScreenshots.position)),
      this.db
        .select()
        .from(workArticles)
        .where(eq(workArticles.workId, row.id))
        .orderBy(asc(workArticles.position)),
    ]);
    return rowToWork(row, { screenshots, articles });
  }

  async listSourceHashes(): Promise<ReadonlyMap<string, string>> {
    const rows = await this.db
      .select({ slug: works.slug, sourceHash: works.sourceHash })
      .from(works);
    return new Map(rows.map((row) => [row.slug, row.sourceHash]));
  }
}
