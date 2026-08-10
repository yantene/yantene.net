import type { NoteSlug } from "./note-slug.vo";
import type { Note, NoteId } from "./note.entity";
import type { IUnpersisted } from "~/backend/domain/shared";

export interface INoteCommandRepository {
  /**
   * ノートのメタデータを slug をキーに upsert する。
   * refresh 時に正本の内容で D1 を同期するための操作。
   * 既存 slug があれば更新、無ければ新規作成し、永続化済みエンティティを返す。
   */
  upsert(note: Note<IUnpersisted>): Promise<Note>;

  /** slug のノートを削除する (正本から消えたノートの掃除に使う)。 */
  deleteBySlug(slug: NoteSlug): Promise<void>;

  /** id のノートを削除する。 */
  delete(id: NoteId): Promise<void>;
}
