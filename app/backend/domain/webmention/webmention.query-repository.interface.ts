import type { Webmention } from "./webmention.entity";
import type { NoteId } from "~/backend/domain/note";

export interface IWebmentionQueryRepository {
  /** 1 記事ぶんを、受け取った順 (古い順) に返す。 */
  listByNoteId(noteId: NoteId): Promise<readonly Webmention[]>;
}
