import type { Slide } from "~/backend/domain/slide";
import { plainDateToIso } from "~/backend/infra/d1/temporal";

/** 発表の場。 */
export interface PublicSlideEvent {
  readonly name: string;
  /** `YYYY-MM-DD`。書いていなければ null。 */
  readonly date: string | null;
  /** 場の案内のページ。書いていなければ null。 */
  readonly url: string | null;
}

/**
 * スライドを出す場所 (`/slides`・`/slides/<slug>`・フィード) が共通で出すスライド。
 *
 * 本文 (MDAST) はここに含めない。読むのは `/slides/<slug>` だけなので、一覧を開くたびに
 * 全件ぶんを運ぶ理由が無い。
 */
export interface PublicSlide {
  readonly slug: string;
  readonly title: string;
  /** 語りの書き出しから作った要約。語りが無ければ空。 */
  readonly summary: string;
  /** `YYYY-MM-DD` */
  readonly publishedOn: string;
  /** 発表しなかったスライドでは null。 */
  readonly event: PublicSlideEvent | null;
  /** ページの数 (表紙と「参考」を含む)。 */
  readonly pageCount: number;
}

export function toPublicSlide(slide: Slide): PublicSlide {
  return {
    slug: slide.slug.toJSON(),
    title: slide.title.toJSON(),
    summary: slide.summary,
    publishedOn: plainDateToIso(slide.publishedOn),
    event: slide.event?.toJSON() ?? null,
    pageCount: slide.pageCount,
  };
}
