import { NoteSlug } from "../../../domain/note/note-slug.vo";
import { ETag } from "../../../domain/shared/etag.vo";
import type {
  IMarkdownStorage,
  MarkdownContent,
  MarkdownListItem,
} from "../../../domain/note/markdown-storage.interface";

const NOTES_PREFIX = "notes/";
const MD_EXTENSION = ".md";

export class MarkdownStorage implements IMarkdownStorage {
  constructor(private readonly r2: R2Bucket) {}

  async get(slug: NoteSlug): Promise<MarkdownContent | undefined> {
    const key = `${NOTES_PREFIX}${slug.value}${MD_EXTENSION}`;
    const r2Object = await this.r2.get(key);

    if (r2Object === null) {
      return undefined;
    }

    return {
      body: r2Object.body,
      etag: ETag.create(r2Object.etag),
    };
  }

  async list(): Promise<readonly MarkdownListItem[]> {
    const r2Objects = await this.r2.list({ prefix: NOTES_PREFIX });

    return r2Objects.objects
      .filter((obj) => obj.key.endsWith(MD_EXTENSION))
      .filter(
        (obj) =>
          !obj.key.slice(NOTES_PREFIX.length, -MD_EXTENSION.length).includes("/"),
      )
      .map((obj) => ({
        slug: NoteSlug.create(
          obj.key.slice(NOTES_PREFIX.length, -MD_EXTENSION.length),
        ),
        etag: ETag.create(obj.etag),
      }));
  }
}
