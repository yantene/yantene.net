import { Temporal } from "@js-temporal/polyfill";
import {
  EntityInterface,
  PersistentEntityInterface,
  TransientEntityInterface,
} from "../../../../common/interfaces/entity.interface";
import { NoteFileId } from "../value-objects/note-file-id.value-object";
import { NoteFilePath } from "../value-objects/note-file-path.value-object";
import { NoteFileSha1 } from "../value-objects/note-file-sha1.value-object";
import { NoteFileUri } from "../value-objects/note-file-uri.value-object";

export type PersistentNoteFile = NoteFile &
  PersistentEntityInterface & {
    path: undefined;
    sha1: NoteFileSha1;
    uri: NoteFileUri;
    uploadedAt: Temporal.Instant;
  };

export type TransientNoteFile = NoteFile &
  TransientEntityInterface & {
    path: NoteFilePath;
    sha1: undefined;
    uri: undefined;
    uploadedAt: undefined;
  };

export class NoteFile implements EntityInterface {
  #id?: NoteFileId;

  #path?: NoteFilePath;

  #sha1?: NoteFileSha1;

  #uri?: NoteFileUri;

  #uploadedAt?: Temporal.Instant;

  /**
   * @param id
   * @param path - If specified, the other parameters must be undefined.
   * @param sha1
   * @param uri
   * @param uploadedAt
   * @throws Error - If the parameters are invalid.
   */
  constructor(
    id: NoteFileId | undefined,
    path: NoteFilePath | undefined,
    sha1: NoteFileSha1 | undefined,
    uri: NoteFileUri | undefined,
    uploadedAt: Temporal.Instant | undefined,
  ) {
    if (
      !(
        (id && !path && sha1 && uri && uploadedAt) ||
        (!id && path && !sha1 && !uri && !uploadedAt)
      )
    ) {
      throw new Error("Invalid NoteFile");
    }

    this.#id = id;

    this.#path = path;

    this.#sha1 = sha1;

    this.#uri = uri;

    this.#uploadedAt = uploadedAt;
  }

  get id(): NoteFileId | undefined {
    return this.#id;
  }

  get path(): NoteFilePath | undefined {
    return this.#path;
  }

  get sha1(): NoteFileSha1 | undefined {
    return this.#sha1;
  }

  get uri(): NoteFileUri | undefined {
    return this.#uri;
  }

  get uploadedAt(): Temporal.Instant | undefined {
    return this.#uploadedAt;
  }

  isPersistent(): this is PersistentNoteFile {
    return (
      !this.#id ||
      !!this.#path ||
      !this.#sha1 ||
      !this.#uri ||
      !this.#uploadedAt
    );
  }

  assertPersistent(): asserts this is PersistentNoteFile {
    if (!this.isPersistent()) {
      throw new Error("NoteFile is not persistent");
    }
  }

  isTransient(): this is TransientNoteFile {
    return (
      !!this.#id ||
      !this.#path ||
      !!this.#sha1 ||
      !!this.#uri ||
      !!this.#uploadedAt
    );
  }

  assertTransient(): asserts this is TransientNoteFile {
    if (!this.isTransient()) {
      throw new Error("NoteFile is not transient");
    }
  }

  toString(): string {
    return {
      id: this.#id,
      path: this.#path,
      sha1: this.#sha1,
      uri: this.#uri,
      uploadedAt: this.#uploadedAt,
    }.toString();
  }

  equals(other: PersistentNoteFile): boolean {
    if (!this.isPersistent()) return false;

    return this.id.equals(other.id);
  }
}
