import { PrismaClient } from "@prisma/client";
import { Temporal } from "@js-temporal/polyfill";
import { NotesRepositoryInterface } from "../../../domain/aggregates/notes/notes.repository.interface";
import {
  Note,
  PersistentNote,
  TransientNote,
} from "../../../domain/aggregates/notes/entities/note.entity";
import { NotImplementedError } from "../../../common/errors/not-implemented.error";
import { NoteId } from "../../../domain/aggregates/notes/value-objects/note-id.value-object";
import { NoteTitle } from "../../../domain/aggregates/notes/value-objects/note-title.value-object";

export class NotesRepository implements NotesRepositoryInterface {
  #prisma: PrismaClient;

  constructor() {
    this.#prisma = new PrismaClient();
  }

  findByCreatedAt(
    _order: "desc" | "asc",
    _limit: number,
    _cursor?: Temporal.Instant | undefined,
  ): Promise<PersistentNote[]> {
    // TODO: IMPLEMENT
    throw new NotImplementedError();
  }

  findByModifiedAt(
    _order: "desc" | "asc",
    _limit: number,
    _cursor?: Temporal.Instant | undefined,
  ): Promise<PersistentNote[]> {
    // TODO: IMPLEMENT
    throw new NotImplementedError();
  }

  findOne(_idOrTitle: NoteId | NoteTitle): Promise<PersistentNote | undefined> {
    // TODO: IMPLEMENT
    throw new NotImplementedError();
  }

  findMany(_idsOrTitles: NoteId[] | NoteTitle[]): Promise<PersistentNote[]> {
    // TODO: IMPLEMENT
    throw new NotImplementedError();
  }

  create(_note: TransientNote): Promise<PersistentNote> {
    // TODO: IMPLEMENT
    throw new NotImplementedError();
  }

  update(_note: PersistentNote): Promise<PersistentNote> {
    // TODO: IMPLEMENT
    throw new NotImplementedError();
  }

  destroy(_idOrTitle: NoteId | NoteTitle): Promise<PersistentNote | undefined> {
    // TODO: IMPLEMENT
    throw new NotImplementedError();
  }

  findLinkedNotes(_idOrTitle: NoteId | NoteTitle): Promise<PersistentNote[]> {
    // TODO: IMPLEMENT
    throw new NotImplementedError();
  }

  findBacklinkedNotes(
    _idOrTitle: NoteId | NoteTitle,
  ): Promise<PersistentNote[]> {
    // TODO: IMPLEMENT
    throw new NotImplementedError();
  }
}
