import { NoteFile as PrismaNoteFile, PrismaClient } from "@prisma/client";
import { toTemporalInstant } from "@js-temporal/polyfill";
import { NoteFileId } from "../../../domain/aggregates/notes/value-objects/note-file-id.value-object";
import { Sha1 } from "../../../domain/aggregates/notes/value-objects/sha1.value-object";
import { NotImplementedError } from "../../../common/errors/not-implemented.error";
import {
  NoteFile,
  PersistentNoteFile,
  TransientNoteFile,
} from "../../../domain/aggregates/notes/entities/note-file.entity";
import { RemoteFile } from "../../../domain/aggregates/notes/value-objects/remote-file.value-object";
import { RemoteFileUri } from "../../../domain/aggregates/notes/value-objects/remote-file-uri.value-object";
import { LocalFile } from "../../../domain/aggregates/notes/value-objects/local-file.value-object";

export class NoteFilesRepository {
  #prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.#prisma = prisma;
  }

  /**
   * Finds and returns one note file by id or SHA-1 hash.
   *
   * @param idOrSha1 - Id or SHA-1 hash of the note file to find
   * @returns Found note file or undefined
   */
  async findOne(
    _idOrSha1: NoteFileId | Sha1,
  ): Promise<PersistentNoteFile | undefined> {
    // TODO: IMPLEMENT
    throw new NotImplementedError();
  }

  /**
   * Finds and returns note files by ids or SHA-1 hashes.
   *
   * @param idsOrSha1s - Ids or SHA-1 hashes of the note files to find
   * @returns Found note files
   */
  async findMany(
    _idsOrSha1s: NoteFileId[] | Sha1[],
  ): Promise<PersistentNoteFile[]> {
    // TODO: IMPLEMENT
    throw new NotImplementedError();
  }

  /**
   * Creates a note file.
   * If the note file already exists, it will be returned.
   *
   * @param noteFile - Note file to create
   * @returns Created or found note file
   */
  async createMissingOne(
    _noteFile: TransientNoteFile,
  ): Promise<PersistentNoteFile> {
    // TODO: IMPLEMENT
    throw new NotImplementedError();
  }

  /**
   * Creates note files.
   * If the note files already exist, they won't be created.
   *
   * @param noteFiles - Note files to create
   * @returns Created or found note files
   */
  async createMissingMany(_noteFiles: TransientNoteFile[]): Promise<void> {
    // TODO: IMPLEMENT
    throw new NotImplementedError();
  }

  /**
   * Cleans up note files that are not referenced by any notes.
   */
  async cleanUp(): Promise<void> {
    // TODO: IMPLEMENT
    throw new NotImplementedError();
  }

  /**
   * Upload local file to S3.
   *
   * @param localFile - Local files
   * @returns Remote files
   */
  async uploadLocalFile(_localFile: LocalFile): Promise<RemoteFile> {
    // TODO: IMPLEMENT
    throw new NotImplementedError();
  }

  /**
   * Convert Prisma NoteFile to NoteFile Entity
   *
   * @param prismaNoteFile - Prisma NoteFile
   * @returns NoteFile Entity
   */
  static toNoteFileEntity(prismaNoteFile: PrismaNoteFile): PersistentNoteFile {
    return NoteFile.buildPersistent(
      new NoteFileId(prismaNoteFile.id),
      new RemoteFile(
        new RemoteFileUri(prismaNoteFile.uri),
        new Sha1(prismaNoteFile.sha1),
        toTemporalInstant.bind(prismaNoteFile.uploadedAt)(),
      ),
    );
  }
}
