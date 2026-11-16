import type { Work, WorkScreenshot, WorkScreenshotKind } from "~/backend/domain/work";

/** 読み手に出すスクリーンショット 1 枚。 */
export interface PublicWorkScreenshot {
  /** アセット API の URL (ルート相対)。 */
  readonly src: string;
  readonly alt: string;
  readonly kind: WorkScreenshotKind;
  /** 寸法を読めなかった画像では null。 */
  readonly width: number | null;
  readonly height: number | null;
}

/** 作った時期。日は書き手が書いた字のまま (`2024` / `2024-06` / `2024-06-04`)。 */
export interface PublicWorkPeriod {
  readonly from: string;
  /** 終わりを書いていなければ null。 */
  readonly until: string | null;
}

/**
 * 作品を出す場所 (`/about`・`/works`・`/works/<slug>`) が共通で出す作品。
 *
 * 詳しい説明 (MDAST) はここに含めない。読むのは `/works/<slug>` だけなので、一覧を
 * 開くたびに全件ぶんを運ぶ理由が無い。
 *
 * ⚠️ **関連記事の slug は載せない** (`Work.articleSlugs`)。あちらには下書きの slug も
 * 入っていて、slug だけでも書きかけの記事が在ることが漏れる。読み手に出すのは、記事の
 * 読み手向けの読み口で引き直した結果だけ (`loadWorkDetailPage`)。「関連記事 N 本」の
 * ような数を出すときも、数えるのは引き直したあとの並びにすること。
 */
export interface PublicWork {
  readonly slug: string;
  readonly name: string;
  readonly summary: string;
  /** 作品そのものの在り処。外に出していなければ null。 */
  readonly url: string | null;
  /** 使った技術の名前。書いた順。書いていなければ空。 */
  readonly stack: readonly string[];
  /** 作った時期。書いていなければ null。 */
  readonly period: PublicWorkPeriod | null;
  /** 自分の役割。書いていなければ null。 */
  readonly role: string | null;
  /** `/works` で大きく出すかどうか。 */
  readonly featured: boolean;
  /** スクリーンショット。書いた順。 */
  readonly screenshots: readonly PublicWorkScreenshot[];
}

function toPublicScreenshot(screenshot: WorkScreenshot): PublicWorkScreenshot {
  return {
    src: screenshot.src,
    alt: screenshot.alt,
    kind: screenshot.kind,
    width: screenshot.dimensions?.width ?? null,
    height: screenshot.dimensions?.height ?? null,
  };
}

export function toPublicWork(work: Work): PublicWork {
  return {
    slug: work.slug.toJSON(),
    name: work.name.toJSON(),
    summary: work.summary.toJSON(),
    url: work.url?.toJSON() ?? null,
    stack: work.stack.toArray(),
    period:
      work.period === undefined
        ? null
        : { from: work.period.from.toString(), until: work.period.until?.toString() ?? null },
    role: work.role?.toString() ?? null,
    featured: work.featured,
    screenshots: work.screenshots.map((screenshot) => toPublicScreenshot(screenshot)),
  };
}
