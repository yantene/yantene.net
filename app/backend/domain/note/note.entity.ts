import type { IEntity } from "../entity.interface";
import type { IPersisted } from "../persisted.interface";
import type { ETag } from "../shared/etag.vo";
import type { IUnpersisted } from "../unpersisted.interface";
import type { ImageUrl } from "./image-url.vo";
import type { NoteSlug } from "./note-slug.vo";
import type { NoteTitle } from "./note-title.vo";
import type { Temporal } from "@js-temporal/polyfill";

export class Note<P extends IPersisted | IUnpersisted> implements IEntity<
  Note<P>
> {
  private constructor(
    readonly id: P["id"],
    readonly title: NoteTitle,
    readonly slug: NoteSlug,
    readonly etag: ETag,
    readonly imageUrl: ImageUrl,
    readonly publishedOn: Temporal.PlainDate,
    readonly lastModifiedOn: Temporal.PlainDate,
    readonly createdAt: P["createdAt"],
    readonly updatedAt: P["updatedAt"],
  ) {}

  static create(params: {
    title: NoteTitle;
    slug: NoteSlug;
    etag: ETag;
    imageUrl: ImageUrl;
    publishedOn: Temporal.PlainDate;
    lastModifiedOn: Temporal.PlainDate;
  }): Note<IUnpersisted> {
    return new Note(
      undefined,
      params.title,
      params.slug,
      params.etag,
      params.imageUrl,
      params.publishedOn,
      params.lastModifiedOn,
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
    publishedOn: Temporal.PlainDate;
    lastModifiedOn: Temporal.PlainDate;
    createdAt: Temporal.Instant;
    updatedAt: Temporal.Instant;
  }): Note<IPersisted> {
    return new Note(
      params.id,
      params.title,
      params.slug,
      params.etag,
      params.imageUrl,
      params.publishedOn,
      params.lastModifiedOn,
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
    publishedOn: string;
    lastModifiedOn: string;
    createdAt: string | undefined;
    updatedAt: string | undefined;
  } {
    return {
      id: this.id,
      title: this.title.toJSON(),
      slug: this.slug.toJSON(),
      etag: this.etag.toJSON(),
      imageUrl: this.imageUrl.toJSON(),
      publishedOn: this.publishedOn.toString(),
      lastModifiedOn: this.lastModifiedOn.toString(),
      createdAt: this.createdAt?.toString(),
      updatedAt: this.updatedAt?.toString(),
    };
  }
}
