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
  constructor(
    readonly id: NoteId | undefined,
    readonly title: NoteTitle,
    readonly path: NotePath,
    readonly createdAt: Temporal.Instant,
    readonly modifiedAt: Temporal.Instant,
    readonly body: NoteBody,
    readonly attachments: NoteFile[],
    readonly linkingNoteIds: NoteId[],
  ) {}

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

  isValid(): boolean {
    return this.isPersistent() || this.isTransient();
  }

  assertValid(): void {
    if (!this.isValid()) throw new Error("Note is invalid");
  }

  toJSON(): {
    id: ReturnType<InstanceType<typeof NoteId>["toJSON"]> | undefined;
    title: ReturnType<InstanceType<typeof NoteTitle>["toJSON"]> | undefined;
    path: ReturnType<InstanceType<typeof NotePath>["toJSON"]> | undefined;
    createdAt: number;
    modifiedAt: number;
    body: ReturnType<InstanceType<typeof NoteBody>["toJSON"]> | undefined;
  } {
    return {
      id: this.id?.toJSON(),
      title: this.title.toJSON(),
      path: this.path.toJSON(),
      createdAt: this.createdAt.epochMilliseconds,
      modifiedAt: this.modifiedAt.epochMilliseconds,
      body: this.body.toJSON(),
    };
  }

  toString(): string {
    return JSON.stringify(this.toJSON());
  }

  equals(other: PersistentNote): boolean {
    if (!this.isPersistent()) return false;

    return this.id.equals(other.id);
  }
}
