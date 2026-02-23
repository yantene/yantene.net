export type { NoteDetailDto as NoteDetailResponse } from "~/backend/domain/note/usecases/get-note-detail.usecase";

export type NoteListItem = {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly imageUrl: string;
  readonly summary: string;
  readonly publishedOn: string;
  readonly lastModifiedOn: string;
};

export type PaginationMeta = {
  readonly page: number;
  readonly perPage: number;
  readonly totalCount: number;
  readonly totalPages: number;
};

export type NotesListResponse = {
  readonly notes: readonly NoteListItem[];
  readonly pagination: PaginationMeta;
};

export type NotesRefreshResponse = {
  readonly added: number;
  readonly updated: number;
  readonly deleted: number;
};
