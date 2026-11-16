import type { IUnpersisted } from "~/backend/domain/shared";
import type { IWorkCommandRepository, Work, WorkSlug } from "~/backend/domain/work";
import { Temporal } from "@js-temporal/polyfill";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { workArticles, workScreenshots, works } from "~/backend/infra/d1/schema";
import { instantToUnix } from "~/backend/infra/d1/temporal";

/*
 * 1 文あたりの行数。**D1 のバインドパラメータ上限 (100) に収まる数で切る。**
 *
 * 欄の数がそのまま 1 行あたりのパラメータ数になる (スクリーンショットは 7、関連記事は 3)。
 *
 * ⚠️ **手元のテストでは踏めない。** `createTestD1` は node:sqlite で、あちらの上限は
 * 32766 なので何行でも通る。超えたときに落ちるのは insert 1 文ではなく **batch ごと**で、
 * そうなるとその作品の同期まるごとが止まる (`profile.command-repository.ts` と同じ手)。
 */
export const SCREENSHOT_ROWS_PER_STATEMENT = 14;
export const ARTICLE_LINK_ROWS_PER_STATEMENT = 33;

/** 行を `size` ごとの塊に分ける。空の入力からは 1 文も作らない。 */
function chunk<T>(rows: readonly T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(rows.length / size) }, (_unused, index) =>
    rows.slice(index * size, (index + 1) * size),
  );
}

export class D1WorkCommandRepository implements IWorkCommandRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  /**
   * slug をキーに upsert する。新規なら id と created_at を採番し、既存なら
   * それらを保持したまま内容と updated_at を更新する。
   *
   * 子の行 (スクリーンショット・関連記事) は差分を取らずに消してから入れ直し、
   * **本体の書き込みと 1 つの batch にまとめる。** D1 の batch は暗黙のトランザクション
   * なので、途中で落ちても「名前は新しいのにスクリーンショットは前のまま」の姿は表に
   * 出ない。
   *
   * 子の行は作品の id を指すので、**batch の前に id を決めておく**。先に引いてから
   * 書くまでの間に別の書き込みが割り込む心配は無い (同期は同時に 2 つ走らない)。
   */
  async upsert(work: Work<IUnpersisted>): Promise<void> {
    const nowUnix = instantToUnix(Temporal.Now.instant());
    const slug = work.slug.toString();
    const workId = (await this.findIdBySlug(slug)) ?? crypto.randomUUID();
    const content = {
      name: work.name.toString(),
      summary: work.summary.toString(),
      url: work.url?.toString() ?? null,
      position: work.position,
      stack: JSON.stringify(work.stack.toArray()),
      periodFrom: work.period?.from.toString() ?? null,
      periodUntil: work.period?.until?.toString() ?? null,
      role: work.role?.toString() ?? null,
      featured: work.featured,
      sourceHash: work.sourceHash,
      updatedAt: nowUnix,
    };

    const screenshotRows = work.screenshots.map((screenshot, position) => ({
      workId,
      position,
      src: screenshot.src,
      alt: screenshot.alt,
      kind: screenshot.kind,
      width: screenshot.dimensions?.width ?? null,
      height: screenshot.dimensions?.height ?? null,
    }));
    const articleRows = work.articleSlugs.map((articleSlug, position) => ({
      workId,
      position,
      articleSlug: articleSlug.toString(),
    }));

    await this.db.batch([
      this.db
        .insert(works)
        .values({ id: workId, slug, createdAt: nowUnix, ...content })
        .onConflictDoUpdate({ target: works.slug, set: content }),
      this.db.delete(workScreenshots).where(eq(workScreenshots.workId, workId)),
      ...chunk(screenshotRows, SCREENSHOT_ROWS_PER_STATEMENT).map((rows) =>
        this.db.insert(workScreenshots).values(rows),
      ),
      this.db.delete(workArticles).where(eq(workArticles.workId, workId)),
      ...chunk(articleRows, ARTICLE_LINK_ROWS_PER_STATEMENT).map((rows) =>
        this.db.insert(workArticles).values(rows),
      ),
    ]);
  }

  /** 子テーブルは FK cascade だが D1 は FK 強制が既定で無効なため明示的に掃除する。 */
  async deleteBySlug(slug: WorkSlug): Promise<void> {
    const workId = await this.findIdBySlug(slug.toString());
    if (workId === undefined) return;
    await this.db.batch([
      this.db.delete(workScreenshots).where(eq(workScreenshots.workId, workId)),
      this.db.delete(workArticles).where(eq(workArticles.workId, workId)),
      this.db.delete(works).where(eq(works.id, workId)),
    ]);
  }

  private async findIdBySlug(slug: string): Promise<string | undefined> {
    const [row] = await this.db
      .select({ id: works.id })
      .from(works)
      .where(eq(works.slug, slug))
      .limit(1);
    return row?.id;
  }
}
