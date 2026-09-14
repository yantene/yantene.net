import type { IWorkCommandRepository, Work, WorkSlug } from "~/backend/domain/work";
import type { IUnpersisted } from "~/backend/domain/shared";
import { Temporal } from "@js-temporal/polyfill";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { works } from "~/backend/infra/d1/schema";
import { instantToUnix } from "~/backend/infra/d1/temporal";

export class D1WorkCommandRepository implements IWorkCommandRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  /**
   * slug をキーに upsert する。新規なら id と created_at を採番し、既存なら
   * それらを保持したまま内容と updated_at を更新する。
   *
   * 記事と違って子の表を持たないので batch は要らない。
   */
  async upsert(work: Work<IUnpersisted>): Promise<void> {
    const nowUnix = instantToUnix(Temporal.Now.instant());
    const content = {
      name: work.name.toString(),
      summary: work.summary.toString(),
      url: work.url?.toString() ?? null,
      position: work.position,
      sourceHash: work.sourceHash,
      updatedAt: nowUnix,
    };

    await this.db
      .insert(works)
      .values({
        id: crypto.randomUUID(),
        slug: work.slug.toString(),
        createdAt: nowUnix,
        ...content,
      })
      .onConflictDoUpdate({ target: works.slug, set: content });
  }

  async deleteBySlug(slug: WorkSlug): Promise<void> {
    await this.db.delete(works).where(eq(works.slug, slug.toString()));
  }
}
