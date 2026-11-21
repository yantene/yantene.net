import type { slides } from "~/backend/infra/d1/schema";
import type { ContentStatus } from "~/backend/domain/shared";
import { entityId, isContentStatus } from "~/backend/domain/shared";
import { Slide, SlideEvent, SlideSlug, SlideTitle } from "~/backend/domain/slide";
import { isoToPlainDate, unixToInstant } from "~/backend/infra/d1/temporal";

type SlideRow = typeof slides.$inferSelect;

/**
 * D1 の行を Slide エンティティに復元する。Command / Query リポジトリで共有する。
 * 値は保存時に VO 経由で検証済みなので、ここでの再検証は破損データの検知を兼ねる
 * (不正なら VO factory が throw する)。
 */
export function rowToSlide(row: SlideRow): Slide {
  return Slide.reconstruct({
    id: entityId<"Slide">(row.id),
    slug: SlideSlug.create(row.slug),
    title: SlideTitle.create(row.title),
    publishedOn: isoToPlainDate(row.publishedOn),
    event: toEvent(row),
    summary: row.summary,
    pageCount: row.pageCount,
    status: toContentStatus(row.status),
    sourceHash: row.sourceHash,
    createdAt: unixToInstant(row.createdAt),
    updatedAt: unixToInstant(row.updatedAt),
  });
}

/**
 * 保存された status を読む。**読めない値を「隠す」に倒さない** (article-row.ts と同じ)。
 * 倒すと、破損した行が黙って一覧から消える。
 */
function toContentStatus(value: string): ContentStatus {
  if (isContentStatus(value)) return value;
  throw new Error(`slides.status has an unreadable value: ${JSON.stringify(value)}`);
}

/** 場の名前が無ければ、発表しなかったスライド。日付と URL は名前に従う。 */
function toEvent(row: SlideRow): SlideEvent | undefined {
  if (row.eventName === null) return undefined;
  return SlideEvent.create({
    name: row.eventName,
    ...(row.eventDate === null ? {} : { date: isoToPlainDate(row.eventDate) }),
    ...(row.eventUrl === null ? {} : { url: row.eventUrl }),
  });
}
