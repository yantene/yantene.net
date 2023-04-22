import {
  EntityInterface,
  PersistentEntityInterface,
  TransientEntityInterface,
} from "../../../../common/interfaces/entity.interface";
import { NoteFileId } from "../value-objects/note-file-id.value-object";
import { RemoteFile } from "../value-objects/remote-file.value-object";
import { LocalFile } from "../value-objects/local-file.value-object";

export type PersistentNoteFile = NoteFile &
  PersistentEntityInterface & {
    remoteFile: RemoteFile;
  };

export type TransientNoteFile = NoteFile &
  TransientEntityInterface & {
    localFile: LocalFile;
  };

export class NoteFile implements EntityInterface {
  #id?: NoteFileId;

  #remoteFile?: RemoteFile;

  #localFile?: LocalFile;

  /**
   * @param id
   * @param remoteFile - If the note file is persistent, this parameter must be set.
   * @param localFile - If the note file is transient, this parameter must be set.
   * @throws Error - If the parameters are invalid.
   */
  constructor(
    id: NoteFileId | undefined,
    remoteFile?: RemoteFile,
    localFile?: LocalFile,
  ) {
    this.#id = id;

    this.#remoteFile = remoteFile;
    this.#localFile = localFile;

    this.assertValid();
  }

  /**
   * Build a persistent note file.
   *
   * @param id
   * @param remoteFile
   * @throws Error - If the parameters are invalid.
   * @returns A persistent note file
   */
  static buildPersistent(
    id: NoteFileId,
    remoteFile: RemoteFile,
  ): PersistentNoteFile {
    const noteFile: NoteFile = new NoteFile(id, remoteFile);

    noteFile.assertPersistent();

    return noteFile;
  }

  /**
   * Build a transient note file.
   *
   * @param localFile
   * @throws Error - If the parameters are invalid.
   * @returns A transient note file
   */
  static buildTransient(localFile: LocalFile): TransientNoteFile {
    const noteFile: NoteFile = new NoteFile(undefined, undefined, localFile);

    noteFile.assertTransient();

    return noteFile;
  }

  get id(): NoteFileId | undefined {
    return this.#id;
  }

  get remoteFile(): RemoteFile | undefined {
    return this.#remoteFile;
  }

  get localFile(): LocalFile | undefined {
    return this.#localFile;
  }

  isPersistent(): this is PersistentNoteFile {
    return !!this.#id && !!this.#remoteFile && !this.#localFile;
  }

  assertPersistent(): asserts this is PersistentNoteFile {
    if (!this.isPersistent()) {
      throw new Error("NoteFile is not persistent");
    }
  }

  isTransient(): this is TransientNoteFile {
    return !this.#id && !this.#remoteFile && !!this.#localFile;
  }

  assertTransient(): asserts this is TransientNoteFile {
    if (!this.isTransient()) {
      throw new Error("NoteFile is not transient");
    }
  }

  isValid(): boolean {
    return this.isPersistent() || this.isTransient();
  }

  assertValid(): void {
    if (!this.isValid()) {
      throw new Error("NoteFile is invalid");
    }
  }

  toJSON(): {
    id: ReturnType<InstanceType<typeof NoteFileId>["toJSON"]> | undefined;
    remoteFile:
      | ReturnType<InstanceType<typeof RemoteFile>["toJSON"]>
      | undefined;
    localFile: ReturnType<InstanceType<typeof LocalFile>["toJSON"]> | undefined;
  } {
    return {
      id: this.#id?.toJSON(),
      remoteFile: this.#remoteFile?.toJSON(),
      localFile: this.#localFile?.toJSON(),
    };
  }

  toString(): string {
    return JSON.stringify(this.toJSON());
  }

  equals(other: PersistentNoteFile): boolean {
    if (!this.isPersistent()) return false;

    return this.id.equals(other.id);
  }
}
