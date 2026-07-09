import type { NoteTag } from "~/backend/domain/note";
import type { notes } from "~/backend/infra/d1/schema";
import { ImageUrl, Note, NoteSlug, NoteTitle } from "~/backend/domain/note";
import { entityId } from "~/backend/domain/shared";
import { isoToPlainDate, unixToInstant } from "~/backend/infra/d1/temporal";

/**
 * D1 の行を Note エンティティに復元する。Command / Query リポジトリで共有する。
 * slug / title / imageUrl は保存時に VO 経由で検証済みなので、ここでの再検証は
 * 破損データの検知を兼ねる (不正なら VO factory が throw する)。
 *
 * タグは別テーブル (note_tags) にあるため、呼び出し側が読み込んで渡す。
 */
export function rowToNote(
  row: typeof notes.$inferSelect,
  tags: readonly NoteTag[] = [],
): Note {
  return Note.reconstruct({
    id: entityId<"Note">(row.id),
    slug: NoteSlug.create(row.slug),
    title: NoteTitle.create(row.title),
    summary: row.summary,
    imageUrl: row.imageUrl === null ? undefined : ImageUrl.create(row.imageUrl),
    tags,
    publishedOn: isoToPlainDate(row.publishedOn),
    lastModifiedOn: isoToPlainDate(row.lastModifiedOn),
    series:
      row.series === null || row.seriesSlug === null || row.seriesOrder === null
        ? undefined
        : { name: row.series, slug: row.seriesSlug, order: row.seriesOrder },
    sourceHash: row.sourceHash,
    createdAt: unixToInstant(row.createdAt),
    updatedAt: unixToInstant(row.updatedAt),
  });
}
