import { Temporal } from "@js-temporal/polyfill";
import { NoteTitle } from "../value-objects/note-title.value-object";
import { NoteId } from "../value-objects/note-id.value-object";
import { NotePath } from "../value-objects/note-path.value-object";
import { NoteBody } from "../value-objects/note-body.value-object";
import { NoteFile } from "./note-file.entity";
import {
  EntityInterface,
  PersistentEntityInterface,
  TransientEntityInterface,
} from "../../../../common/interfaces/entity.interface";

export type PersistentNote = Note & PersistentEntityInterface;

export type TransientNote = Note & TransientEntityInterface;

export class Note implements EntityInterface {
  #id?: NoteId;

  #title: NoteTitle;

  #path: NotePath;

  #createdAt: Temporal.Instant;

  #modifiedAt: Temporal.Instant;

  #body: NoteBody;

  #attachments: NoteFile[];

  #linkingNoteIds: NoteId[];

  constructor(
    id: NoteId | undefined,
    title: NoteTitle,
    path: NotePath,
    createdAt: Temporal.Instant,
    modifiedAt: Temporal.Instant,
    body: NoteBody,
    attachments: NoteFile[],
    linkingNoteIds: NoteId[],
  ) {
    this.#id = id;
    this.#title = title;
    this.#path = path;

    this.#createdAt = createdAt;
    this.#modifiedAt = modifiedAt;

    this.#body = body;

    this.#attachments = attachments;
    this.#linkingNoteIds = linkingNoteIds;
  }

  /**
   * Build a persistent note.
   *
   * @param id
   * @param title
   * @param path
   * @param createdAt
   * @param modifiedAt
   * @param body
   * @param attachments
   * @param linkingNoteIds
   * @returns Built persistent note
   */
  static buildPersistent(
    id: NoteId,
    title: NoteTitle,
    path: NotePath,
    createdAt: Temporal.Instant,
    modifiedAt: Temporal.Instant,
    body: NoteBody,
    attachments: NoteFile[],
    linkingNoteIds: NoteId[],
  ): PersistentNote {
    const note: Note = new Note(
      id,
      title,
      path,
      createdAt,
      modifiedAt,
      body,
      attachments,
      linkingNoteIds,
    );

    note.assertPersistent();

    return note;
  }

  /**
   * Build a transient note.
   *
   * @param title
   * @param path
   * @param body
   * @param attachments
   * @param linkingNoteIds
   * @param createdAt - Defaults to `Temporal.Now.instant()`.
   * @param modifiedAt - Defaults to `Temporal.Now.instant()`.
   * @returns Built transient note
   */
  static buildTransient(
    title: NoteTitle,
    path: NotePath,
    body: NoteBody,
    attachments: NoteFile[],
    linkingNoteIds: NoteId[],
    createdAt = Temporal.Now.instant(),
    modifiedAt = Temporal.Now.instant(),
  ): TransientNote {
    const note: Note = new Note(
      undefined,
      title,
      path,
      createdAt,
      modifiedAt,
      body,
      attachments,
      linkingNoteIds,
    );

    note.assertTransient();

    return note;
  }

  get id(): NoteId | undefined {
    return this.#id;
  }

  get title(): NoteTitle {
    return this.#title;
  }

  get path(): NotePath {
    return this.#path;
  }

  get createdAt(): Temporal.Instant {
    return this.#createdAt;
  }

  get modifiedAt(): Temporal.Instant {
    return this.#modifiedAt;
  }

  get body(): NoteBody {
    return this.#body;
  }

  get attachments(): NoteFile[] {
    return this.#attachments;
  }

  get linkingNoteIds(): NoteId[] {
    return this.#linkingNoteIds;
  }

  isPersistent(): this is PersistentNote {
    return !!this.id;
  }

  assertPersistent(): asserts this is PersistentNote {
    if (!this.isPersistent()) throw new Error("Note is not persistent");
  }

  isTransient(): this is TransientNote {
    return !this.id;
  }

  assertTransient(): asserts this is TransientNote {
    if (!this.isTransient()) throw new Error("Note is not transient");
  }

  toString(): string {
    return {
      id: this.#id,
      title: this.#title,
      path: this.#path,
      createdAt: this.#createdAt,
      modifiedAt: this.#modifiedAt,
      body: this.#body,
    }.toString();
  }

  equals(other: PersistentNote): boolean {
    if (!this.isPersistent()) return false;

    return this.id.equals(other.id);
  }
}
