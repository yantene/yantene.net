import type { NoteSlug } from "./note-slug.vo";
import type { ETag } from "../shared/etag.vo";

export type MarkdownContent = {
  readonly body: ReadableStream;
  readonly etag: ETag;
};

export type MarkdownListItem = {
  readonly slug: NoteSlug;
  readonly etag: ETag;
};

export interface IMarkdownStorage {
  get(slug: NoteSlug): Promise<MarkdownContent | undefined>;
  list(): Promise<readonly MarkdownListItem[]>;
}
