import type { Note } from "~/backend/domain/note";

/** ノート詳細で公開するメタデータ (内部 id は出さない)。 */
export interface PublicNoteMeta {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly imageUrl: string | null;
  readonly tags: readonly string[];
  readonly publishedOn: string;
  readonly lastModifiedOn: string;
}

/** 詳細レスポンス / ページ props。メタデータ + パース済み MDAST。 */
export interface NoteDetail {
  readonly note: PublicNoteMeta;
  readonly mdast: unknown;
}

export function toNoteDetail(note: Note, mdast: unknown): NoteDetail {
  return {
    note: {
      slug: note.slug.toJSON(),
      title: note.title.toJSON(),
      summary: note.summary,
      imageUrl: note.imageUrl?.toJSON() ?? null,
      tags: note.tags.map((tag) => tag.toJSON()),
      publishedOn: note.publishedOn.toString({ calendarName: "never" }),
      lastModifiedOn: note.lastModifiedOn.toString({ calendarName: "never" }),
    },
    mdast,
  };
}
