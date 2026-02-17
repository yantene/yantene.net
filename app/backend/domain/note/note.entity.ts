import type { IEntity } from "../entity.interface";
import type { IPersisted } from "../persisted.interface";
import type { ETag } from "../shared/etag.vo";
import type { IUnpersisted } from "../unpersisted.interface";
import type { ImageUrl } from "./image-url.vo";
import type { NoteSlug } from "./note-slug.vo";
import type { NoteTitle } from "./note-title.vo";
import type { Temporal } from "@js-temporal/polyfill";

export class Note<P extends IPersisted | IUnpersisted>
  implements IEntity<Note<P>>
{
  private constructor(
    readonly id: P["id"],
    readonly title: NoteTitle,
    readonly slug: NoteSlug,
    readonly etag: ETag,
    readonly imageUrl: ImageUrl,
    readonly createdAt: P["createdAt"],
    readonly updatedAt: P["updatedAt"],
  ) {}

  static create(params: {
    title: NoteTitle;
    slug: NoteSlug;
    etag: ETag;
    imageUrl: ImageUrl;
  }): Note<IUnpersisted> {
    return new Note(
      undefined,
      params.title,
      params.slug,
      params.etag,
      params.imageUrl,
      undefined,
      undefined,
    );
  }

  static reconstruct(params: {
    id: string;
    title: NoteTitle;
    slug: NoteSlug;
    etag: ETag;
    imageUrl: ImageUrl;
    createdAt: Temporal.Instant;
    updatedAt: Temporal.Instant;
  }): Note<IPersisted> {
    return new Note(
      params.id,
      params.title,
      params.slug,
      params.etag,
      params.imageUrl,
      params.createdAt,
      params.updatedAt,
    );
  }

  equals(other: Note<P>): boolean {
    if (this.id == null || other.id == null) {
      return this === other;
    }
    return this.id === other.id;
  }

  toJSON(): {
    id: P["id"];
    title: string;
    slug: string;
    etag: string;
    imageUrl: string;
    createdAt: string | undefined;
    updatedAt: string | undefined;
  } {
    return {
      id: this.id,
      title: this.title.toJSON(),
      slug: this.slug.toJSON(),
      etag: this.etag.toJSON(),
      imageUrl: this.imageUrl.toJSON(),
      createdAt: this.createdAt?.toString(),
      updatedAt: this.updatedAt?.toString(),
    };
  }
}
