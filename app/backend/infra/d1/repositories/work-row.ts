import type { workArticles, workScreenshots, works } from "~/backend/infra/d1/schema";
import { ArticleSlug } from "~/backend/domain/article";
import { HistoryDate } from "~/backend/domain/profile";
import { entityId } from "~/backend/domain/shared";
import {
  isWorkScreenshotKind,
  Work,
  WorkName,
  WorkPeriod,
  WorkRole,
  WorkScreenshot,
  WorkSlug,
  WorkStack,
  WorkSummary,
  WorkUrl,
} from "~/backend/domain/work";
import { unixToInstant } from "~/backend/infra/d1/temporal";

type WorkRow = typeof works.$inferSelect;
type ScreenshotRow = typeof workScreenshots.$inferSelect;
type ArticleLinkRow = typeof workArticles.$inferSelect;

/** 作品 1 件に属する子の行。どちらも `position` の小さい順に並んでいること。 */
export interface WorkChildRows {
  readonly screenshots: readonly ScreenshotRow[];
  readonly articles: readonly ArticleLinkRow[];
}

/** 保存されている行が読めない (書き込み経路を通っていない値が入っている)。 */
export class CorruptWorkRowError extends Error {
  readonly name = "CorruptWorkRowError";
}

/**
 * D1 の行を Work エンティティに復元する。Command / Query リポジトリで共有する。
 * 値は保存時に VO 経由で検証済みなので、ここでの再検証は破損データの検知を兼ねる
 * (不正なら VO factory が throw する)。
 */
export function rowToWork(row: WorkRow, children: WorkChildRows): Work {
  return Work.reconstruct({
    id: entityId<"Work">(row.id),
    slug: WorkSlug.create(row.slug),
    name: WorkName.create(row.name),
    summary: WorkSummary.create(row.summary),
    url: row.url === null ? undefined : WorkUrl.create(row.url),
    position: row.position,
    stack: WorkStack.create(parseStack(row)),
    period: toPeriod(row),
    role: row.role === null ? undefined : WorkRole.create(row.role),
    featured: row.featured,
    screenshots: children.screenshots.map((child) => toScreenshot(child)),
    articleSlugs: children.articles.map((child) => ArticleSlug.create(child.articleSlug)),
    sourceHash: row.sourceHash,
    createdAt: unixToInstant(row.createdAt),
    updatedAt: unixToInstant(row.updatedAt),
  });
}

/** `stack` の列は JSON の配列。文字列の並びでなければ破損として扱う。 */
function parseStack(row: WorkRow): readonly string[] {
  const parsed: unknown = JSON.parse(row.stack);
  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) {
    throw new CorruptWorkRowError(`works.stack is not a list of strings: ${row.slug}`);
  }
  return parsed;
}

function toPeriod(row: WorkRow): WorkPeriod | undefined {
  if (row.periodFrom === null) return undefined;
  return WorkPeriod.create({
    from: HistoryDate.create(row.periodFrom),
    ...(row.periodUntil === null ? {} : { until: HistoryDate.create(row.periodUntil) }),
  });
}

function toScreenshot(row: ScreenshotRow): WorkScreenshot {
  if (!isWorkScreenshotKind(row.kind)) {
    throw new CorruptWorkRowError(`work_screenshots.kind is unknown: ${row.kind}`);
  }
  return WorkScreenshot.create({
    src: row.src,
    alt: row.alt,
    kind: row.kind,
    ...(row.width === null || row.height === null
      ? {}
      : { dimensions: { width: row.width, height: row.height } }),
  });
}
