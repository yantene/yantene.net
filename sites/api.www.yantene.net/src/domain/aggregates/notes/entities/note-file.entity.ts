import { Temporal } from "@js-temporal/polyfill";
import { NoteFileId } from "../value-objects/note-file-id.value-object";
import { NoteFileSha1 } from "../value-objects/note-file-sha1.value-object";
import { NoteFileUri } from "../value-objects/note-file-uri.value-object";
import { EntityInterface } from "../../../../common/interfaces/entity.interface";

export class NoteFile implements EntityInterface {
  #id?: NoteFileId;

  #sha1: NoteFileSha1;

  #uri: NoteFileUri;

  #uploadedAt: Temporal.Instant;

  constructor(
    id: NoteFileId | undefined,
    sha1: NoteFileSha1,
    uri: NoteFileUri,
    uploadedAt: Temporal.Instant,
  ) {
    this.#id = id;
    this.#sha1 = sha1;

    this.#uri = uri;

    this.#uploadedAt = uploadedAt;
  }

  get id(): NoteFileId | undefined {
    return this.#id;
  }

  get sha1(): NoteFileSha1 {
    return this.#sha1;
  }

  get uri(): NoteFileUri {
    return this.#uri;
  }

  get uploadedAt(): Temporal.Instant {
    return this.#uploadedAt;
  }

  toString(): string {
    return {
      id: this.#id,
      sha1: this.#sha1,
      uri: this.#uri,
      uploadedAt: this.#uploadedAt,
    }.toString();
  }

  equals(other: NoteFile): boolean {
    if (!this.id || !other.id) return false;

    return this.id.equals(other.id);
  }
}
