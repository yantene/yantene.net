import {
  NoteAttachment as PrismaNoteAttachment,
  NoteFile as PrismaNoteFile,
  NoteLink as PrismaNoteLink,
  Note as PrismaNote,
  PrismaClient,
} from "@prisma/client";
import { Temporal, toTemporalInstant } from "@js-temporal/polyfill";
import { Injectable } from "@nestjs/common";
import { NotesRepositoryInterface } from "../../../domain/aggregates/notes/notes.repository.interface";
import {
  Note,
  PersistentNote,
  TransientNote,
} from "../../../domain/aggregates/notes/entities/note.entity";
import { NotImplementedError } from "../../../common/errors/not-implemented.error";
import { NoteId } from "../../../domain/aggregates/notes/value-objects/note-id.value-object";
import { NoteTitle } from "../../../domain/aggregates/notes/value-objects/note-title.value-object";
import { NotePath } from "../../../domain/aggregates/notes/value-objects/note-path.value-object";
import { NoteBody } from "../../../domain/aggregates/notes/value-objects/note-body.value-object";
import { PersistentNoteFile } from "../../../domain/aggregates/notes/entities/note-file.entity";
import { NoteFilesRepository } from "./note-files.repository";

@Injectable()
export class NotesRepository implements NotesRepositoryInterface {
  #prisma: PrismaClient;

  #noteFilesRepository: NoteFilesRepository;

  constructor(prisma: PrismaClient) {
    this.#prisma = prisma;

    this.#noteFilesRepository = new NoteFilesRepository(prisma);
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

  /**
   * Convert Prisma Note to Note Entity
   *
   * @param prismaNote - Prisma Note with relations
   * @returns Note Entity
   */
  static toNoteEntity(
    prismaNote: PrismaNote & {
      links: PrismaNoteLink[];
      attachments: (PrismaNoteAttachment & {
        noteFile: PrismaNoteFile;
      })[];
    },
  ): PersistentNote {
    return Note.buildPersistent(
      new NoteId(prismaNote.id),
      new NoteTitle(prismaNote.title),
      new NotePath(prismaNote.path),
      toTemporalInstant.bind(prismaNote.createdAt)(),
      toTemporalInstant.bind(prismaNote.modifiedAt)(),
      new NoteBody(prismaNote.body),
      prismaNote.attachments.map<PersistentNoteFile>(
        ({ noteFile: prismaNoteFile }) =>
          NoteFilesRepository.toNoteFileEntity(prismaNoteFile),
      ),
      prismaNote.links.map((link) => new NoteId(link.toNoteId)),
    );
  }
}
