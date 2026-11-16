import type { IUnpersisted } from "~/backend/domain/shared";
import type { ISlideCommandRepository, Slide, SlideSlug } from "~/backend/domain/slide";
import { Temporal } from "@js-temporal/polyfill";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { slides } from "~/backend/infra/d1/schema";
import { instantToUnix, plainDateToIso } from "~/backend/infra/d1/temporal";

export class D1SlideCommandRepository implements ISlideCommandRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  /**
   * slug をキーに upsert する。新規なら id と created_at を採番し、既存なら
   * それらを保持したまま内容と updated_at を更新する。
   *
   * 子の表を持たないので 1 文で済む (作品のように batch へまとめるものが無い)。
   */
  async upsert(slide: Slide<IUnpersisted>): Promise<void> {
    const nowUnix = instantToUnix(Temporal.Now.instant());
    const content = {
      title: slide.title.toString(),
      publishedOn: plainDateToIso(slide.publishedOn),
      eventName: slide.event?.name ?? null,
      eventDate: slide.event?.date === undefined ? null : plainDateToIso(slide.event.date),
      eventUrl: slide.event?.url ?? null,
      summary: slide.summary,
      pageCount: slide.pageCount,
      sourceHash: slide.sourceHash,
      updatedAt: nowUnix,
    };

    await this.db
      .insert(slides)
      .values({
        id: crypto.randomUUID(),
        slug: slide.slug.toString(),
        createdAt: nowUnix,
        ...content,
      })
      .onConflictDoUpdate({ target: slides.slug, set: content });
  }

  async deleteBySlug(slug: SlideSlug): Promise<void> {
    await this.db.delete(slides).where(eq(slides.slug, slug.toString()));
  }
}
