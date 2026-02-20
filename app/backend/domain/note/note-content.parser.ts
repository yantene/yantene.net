import { Temporal } from "@js-temporal/polyfill";
import { VFile } from "vfile";
import { matter } from "vfile-matter";
import { NoteMetadataValidationError, NoteParseError } from "./errors";
import { ImageUrl } from "./image-url.vo";
import { NoteTitle } from "./note-title.vo";
import type { NoteSlug } from "./note-slug.vo";

const isAbsoluteUrl = (url: string): boolean =>
  url.startsWith("/") ||
  url.startsWith("http://") ||
  url.startsWith("https://");

const resolveImageUrl = (url: string, slug: NoteSlug): string => {
  if (isAbsoluteUrl(url)) return url;
  const normalized = url.startsWith("./") ? url.slice(2) : url;
  return `/api/v1/notes/${slug.value}/assets/${normalized}`;
};

export type NoteMetadata = {
  readonly title: NoteTitle;
  readonly imageUrl: ImageUrl;
  readonly publishedOn: Temporal.PlainDate;
  readonly lastModifiedOn: Temporal.PlainDate;
};

export function parseNoteContent(
  content: string,
  slug: NoteSlug,
): NoteMetadata {
  const fileName = `${slug.value}.md`;

  const file = new VFile(content);
  try {
    matter(file);
  } catch {
    throw new NoteParseError(fileName);
  }

  const raw = file.data["matter"] as Record<string, unknown> | undefined;
  if (!raw || Object.keys(raw).length === 0) {
    throw new NoteParseError(fileName);
  }

  const title = raw["title"];
  const imageUrl = raw["imageUrl"];
  const publishedOn = raw["publishedOn"];
  const lastModifiedOn = raw["lastModifiedOn"];

  const fieldChecks = [
    ["title", title],
    ["imageUrl", imageUrl],
    ["publishedOn", publishedOn],
    ["lastModifiedOn", lastModifiedOn],
  ] as const;

  const missingFields = fieldChecks
    .filter(([, value]) => value === undefined || value === null)
    .map(([name]) => name);
  if (missingFields.length > 0) {
    throw new NoteMetadataValidationError(fileName, missingFields);
  }

  return {
    title: NoteTitle.create(String(title)),
    imageUrl: ImageUrl.create(resolveImageUrl(String(imageUrl), slug)),
    publishedOn: Temporal.PlainDate.from(String(publishedOn)),
    lastModifiedOn: Temporal.PlainDate.from(String(lastModifiedOn)),
  };
}
