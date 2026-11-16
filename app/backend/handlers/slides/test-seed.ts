import { Temporal } from "@js-temporal/polyfill";
import { Slide, SlideEvent, SlideSlug, SlideTitle } from "~/backend/domain/slide";
import { D1SlideCommandRepository } from "~/backend/infra/d1/repositories";

/** テスト用。スライドを 1 本、索引 (D1) に入れる。書かなかった欄は見本の値になる。 */
export async function seedSlide(
  d1: D1Database,
  params: {
    slug?: string;
    title?: string;
    publishedOn?: string;
    summary?: string;
    event?: { name: string; date?: string; url?: string };
    pageCount?: number;
    sourceHash?: string;
  } = {},
): Promise<void> {
  const event =
    params.event === undefined
      ? undefined
      : SlideEvent.create({
          name: params.event.name,
          ...(params.event.date === undefined
            ? {}
            : { date: Temporal.PlainDate.from(params.event.date) }),
          ...(params.event.url === undefined ? {} : { url: params.event.url }),
        });
  await new D1SlideCommandRepository(d1).upsert(
    Slide.create({
      slug: SlideSlug.create(params.slug ?? "semantic-slides"),
      title: SlideTitle.create(params.title ?? "意味だけで書くスライド"),
      publishedOn: Temporal.PlainDate.from(params.publishedOn ?? "2026-11-14"),
      event,
      summary: params.summary ?? "語りの書き出し。",
      pageCount: params.pageCount ?? 12,
      sourceHash: params.sourceHash ?? "h1",
    }),
  );
}
