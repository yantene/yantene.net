import type { works } from "~/backend/infra/d1/schema";
import { Work, WorkName, WorkSlug, WorkSummary, WorkUrl } from "~/backend/domain/work";
import { entityId } from "~/backend/domain/shared";
import { unixToInstant } from "~/backend/infra/d1/temporal";

/**
 * D1 の行を Work エンティティに復元する。Command / Query リポジトリで共有する。
 * 値は保存時に VO 経由で検証済みなので、ここでの再検証は破損データの検知を兼ねる
 * (不正なら VO factory が throw する)。
 */
export function rowToWork(row: typeof works.$inferSelect): Work {
  return Work.reconstruct({
    id: entityId<"Work">(row.id),
    slug: WorkSlug.create(row.slug),
    name: WorkName.create(row.name),
    summary: WorkSummary.create(row.summary),
    url: row.url === null ? undefined : WorkUrl.create(row.url),
    position: row.position,
    sourceHash: row.sourceHash,
    createdAt: unixToInstant(row.createdAt),
    updatedAt: unixToInstant(row.updatedAt),
  });
}
