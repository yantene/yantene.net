import type { Root } from "mdast";

export type NotesRefreshResponse = {
  readonly added: number;
  readonly updated: number;
  readonly deleted: number;
};

export type NoteDetailResponse = {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly imageUrl: string;
  readonly publishedOn: string;
  readonly lastModifiedOn: string;
  readonly content: Root;
};
