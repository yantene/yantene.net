import type { notes } from "~/backend/infra/d1/schema";
import { ImageUrl, Note, NoteSlug, NoteTitle } from "~/backend/domain/note";
import { entityId } from "~/backend/domain/shared";
import { isoToPlainDate, unixToInstant } from "~/backend/infra/d1/temporal";

/**
 * D1 の行を Note エンティティに復元する。Command / Query リポジトリで共有する。
 * slug / title / imageUrl は保存時に VO 経由で検証済みなので、ここでの再検証は
 * 破損データの検知を兼ねる (不正なら VO factory が throw する)。
 */
export function rowToNote(row: typeof notes.$inferSelect): Note {
  return Note.reconstruct({
    id: entityId<"Note">(row.id),
    slug: NoteSlug.create(row.slug),
    title: NoteTitle.create(row.title),
    summary: row.summary,
    imageUrl: row.imageUrl === null ? undefined : ImageUrl.create(row.imageUrl),
    publishedOn: isoToPlainDate(row.publishedOn),
    lastModifiedOn: isoToPlainDate(row.lastModifiedOn),
    createdAt: unixToInstant(row.createdAt),
    updatedAt: unixToInstant(row.updatedAt),
  });
}
