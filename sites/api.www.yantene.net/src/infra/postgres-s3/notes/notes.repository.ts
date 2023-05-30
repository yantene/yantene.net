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
import {
  NoteFile,
  PersistentNoteFile,
  TransientNoteFile,
} from "../../../domain/aggregates/notes/entities/note-file.entity";
import { Sha1 } from "../../../domain/aggregates/notes/value-objects/sha1.value-object";
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

  async create(note: TransientNote): Promise<PersistentNote> {
    const prismaCreatedNote = await this.#prisma.note.create({
      data: {
        title: note.title.value,
        path: note.path.value,
        createdAt: new Date(note.createdAt.epochMilliseconds),
        modifiedAt: new Date(note.modifiedAt.epochMilliseconds),
        body: note.body.value,
      },
    });

    const createdNoteId = new NoteId(prismaCreatedNote.id);

    await this.#refreshNoteLinks(
      createdNoteId,
      note.linkingNoteIds.map((id) => new NoteId(BigInt(id.value))),
    );

    await this.#refreshNoteAttachments(createdNoteId, note.attachments);

    const createdNote = await this.findOne(createdNoteId);

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return createdNote!;
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

  /**
   * Drop deleted note links and create new note links.
   *
   * @param fromNoteId - NoteId of the note that links to other notes
   * @param toNoteIds - NoteIds of the notes that are linked from the note
   * @returns void
   */
  async #refreshNoteLinks(
    fromNoteId: NoteId,
    toNoteIds: NoteId[],
  ): Promise<void> {
    const presentPrismaNoteLinks = await this.#prisma.noteLink.findMany({
      where: {
        fromNoteId: fromNoteId.value,
      },
    });

    const newLinkedNoteIdSet = new Set(toNoteIds.map((tni) => tni.value));
    const presentLinkedNoteIdSet = new Set(
      presentPrismaNoteLinks.map((l) => l.toNoteId),
    );

    // presentLinkedNoteIds - newLinkedNoteIds
    const removedLinkedNoteIds = Array.from(presentLinkedNoteIdSet)
      .filter((pid) => !newLinkedNoteIdSet.has(pid))
      .map((id) => new NoteId(id));

    await this.#prisma.noteLink.deleteMany({
      where: {
        fromNoteId: fromNoteId.value,
        toNoteId: {
          in: removedLinkedNoteIds.map((id) => id.value),
        },
      },
    });

    // newLinkedNoteIds - presentLinkedNoteIds
    const addedLinkedNoteIds = Array.from(newLinkedNoteIdSet)
      .filter((nid) => !presentLinkedNoteIdSet.has(nid))
      .map((id) => new NoteId(id));

    await this.#prisma.noteLink.createMany({
      data: addedLinkedNoteIds.map((id) => ({
        fromNoteId: fromNoteId.value,
        toNoteId: id.value,
      })),
    });
  }

  /**
   * Drop deleted note attachments and create new note attachments.
   * Note that the NoteFile record is not deleted.
   *
   * @param noteId - NoteId of the note that has attachments
   * @param attachments - NoteFiles of the note
   * @returns void
   */
  async #refreshNoteAttachments(
    noteId: NoteId,
    attachments: NoteFile[],
  ): Promise<void> {
    const presentPrismaNoteAttachments =
      await this.#prisma.noteAttachment.findMany({
        where: {
          noteId: noteId.value,
        },
        include: {
          noteFile: true,
        },
      });

    const newAttachmentNoteFileSha1HexSet = new Set(
      attachments.map((a) => a.sha1.value.toString("hex")),
    );
    const presentAttachmentNoteFileSha1HexSet = new Set(
      presentPrismaNoteAttachments.map((a) => a.noteFile.sha1.toString("hex")),
    );

    // presentAttachmentNoteFileSha1s - newAttachmentNoteFileSha1s
    const removedAttachmentNoteFileSha1s = Array.from(
      presentAttachmentNoteFileSha1HexSet,
    )
      .filter((psha1) => !newAttachmentNoteFileSha1HexSet.has(psha1))
      .map(Sha1.buildFromHex);

    await this.#removeNoteAttachments(noteId, removedAttachmentNoteFileSha1s);

    // newAttachmentNoteFileSha1s - presentAttachmentNoteFileSha1s
    const addedAttachmentNoteFiles = Array.from(newAttachmentNoteFileSha1HexSet)
      .filter((nsha1) => !presentAttachmentNoteFileSha1HexSet.has(nsha1))
      .map(
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        (hex) => attachments.find((a) => a.sha1.value.toString("hex") === hex)!,
      );

    await this.#addNoteAttachments(noteId, addedAttachmentNoteFiles);
  }

  async #removeNoteAttachments(
    noteId: NoteId,
    removedAttachmentNoteFileSha1s: Sha1[],
  ): Promise<void> {
    await this.#prisma.noteAttachment.deleteMany({
      where: {
        noteId: noteId.value,
        noteFile: {
          sha1: {
            in: removedAttachmentNoteFileSha1s.map((sha1) => sha1.value),
          },
        },
      },
    });
  }

  async #addNoteAttachments(
    noteId: NoteId,
    addedAttachmentNoteFiles: NoteFile[],
  ): Promise<void> {
    await this.#noteFilesRepository.createMissingMany(
      addedAttachmentNoteFiles.filter((f): f is TransientNoteFile =>
        f.isTransient(),
      ),
    );

    const addedAttachmentPersistentNoteFiles =
      await this.#noteFilesRepository.findMany(
        addedAttachmentNoteFiles.map((f) => f.sha1),
      );
    const sha1ToNoteFileIdMap = new Map(
      addedAttachmentPersistentNoteFiles.map((nf) => [
        nf.sha1.value.toString("hex"),
        nf.id.value,
      ]),
    );

    await this.#prisma.noteAttachment.createMany({
      data: addedAttachmentNoteFiles.map((nf) => ({
        noteId: noteId.value,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        noteFileId: sha1ToNoteFileIdMap.get(nf.sha1.value.toString("hex"))!,
      })),
    });
  }
}
