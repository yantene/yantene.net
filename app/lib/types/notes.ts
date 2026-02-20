export type { NoteDetailDto as NoteDetailResponse } from "~/backend/domain/note/usecases/get-note-detail.usecase";

export type NotesRefreshResponse = {
  readonly added: number;
  readonly updated: number;
  readonly deleted: number;
};
