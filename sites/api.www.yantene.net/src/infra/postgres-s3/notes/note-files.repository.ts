import { NoteFile as PrismaNoteFile, PrismaClient } from "@prisma/client";
import { Temporal, toTemporalInstant } from "@js-temporal/polyfill";
import { createReadStream } from "fs";
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

  #bucketName: string;

  #minioUriPrefix: string;

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
    idsOrSha1s: NoteFileId[] | Sha1[],
  ): Promise<PersistentNoteFile[]> {
    const prismaNoteFiles = await this.#prisma.noteFile.findMany({
      where: ((a): a is NoteFileId[] => a[0] instanceof NoteFileId)(idsOrSha1s)
        ? { id: { in: idsOrSha1s.map((id) => id.value) } }
        : { sha1: { in: idsOrSha1s.map((sha1) => sha1.value) } },
    });

    return prismaNoteFiles.map(NoteFilesRepository.toNoteFileEntity);
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
  async createMissingMany(noteFiles: TransientNoteFile[]): Promise<void> {
    const presentNoteFiles = await this.findMany(
      noteFiles.map((nf) => nf.sha1),
    );

    const presentNoteFileSha1HexSet = new Set(
      presentNoteFiles.map((noteFile) => noteFile.sha1.value.toString("hex")),
    );

    const missingNoteFiles = noteFiles.filter(
      (noteFile) =>
        !presentNoteFileSha1HexSet.has(noteFile.sha1.value.toString("hex")),
    );

    await this.#createMany(missingNoteFiles);
  }

  /**
   * Creates note files.
   */
  async #createMany(noteFiles: TransientNoteFile[]): Promise<void> {
    // TODO: If the note files already exist, they will be removed.
    const remoteFiles = await Promise.all(
      noteFiles.map((nf) => this.uploadLocalFile(nf.localFile)),
    );

    await this.#prisma.noteFile.createMany({
      data: await Promise.all(
        noteFiles.map(async (noteFile, idx) => {
          const remoteFile = remoteFiles[idx];

          return {
            sha1: noteFile.sha1.value,
            uri: remoteFile.uri.value,
            uploadedAt: new Date(remoteFile.uploadedAt.epochMilliseconds),
          };
        }),
      ),
    });
  }

  /**
   * Cleans up note files that are not referenced by any notes.
   */
  async cleanUp(): Promise<void> {
    // TODO: IMPLEMENT
    throw new NotImplementedError();
  }

  /**
   * Upload local file to Minio.
   *
   * @param localFile - Local files
   * @returns Remote files
   */
  async uploadLocalFile(localFile: LocalFile): Promise<RemoteFile> {
    throw new NotImplementedError();

    /*
    // Upload to Minio
    const response = await this.#minio.fPutObject(
      this.#bucketName,
      localFile.sha1.toString(),
      localFile.path,
    );

    console.log(localFile.sha1.toString());
    console.log(response);

    return new RemoteFile(
      new RemoteFileUri(`${this.#minioUriPrefix}/${localFile.sha1}`),
      localFile.sha1,
      Temporal.Now.instant(),
    );
    */
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
