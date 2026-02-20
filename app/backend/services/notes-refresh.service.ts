import { parseNoteContent } from "../domain/note/note-content.parser";
import { NoteSlug } from "../domain/note/note-slug.vo";
import { Note } from "../domain/note/note.entity";
import type { SyncResult } from "./sync-result";
import type { INoteCommandRepository } from "../domain/note/note.command-repository.interface";
import type { INoteQueryRepository } from "../domain/note/note.query-repository.interface";
import type {
  IStoredObjectStorage,
  StoredObjectListItem,
} from "../domain/shared/object-storage.interface";

export class NotesRefreshService {
  constructor(
    private readonly storage: IStoredObjectStorage,
    private readonly queryRepository: INoteQueryRepository,
    private readonly commandRepository: INoteCommandRepository,
  ) {}

  async execute(): Promise<SyncResult> {
    const [storageObjects, dbNotes] = await Promise.all([
      this.storage.list(),
      this.queryRepository.findAll(),
    ]);

    const storageMap = new Map(
      storageObjects.map((obj) => [
        NotesRefreshService.extractSlug(obj.objectKey.value),
        obj,
      ]),
    );
    const dbMap = new Map(dbNotes.map((note) => [note.slug.value, note]));

    const storageEntries = [...storageMap.entries()];
    const toAdd = storageEntries.filter(([slug]) => !dbMap.has(slug));
    const toUpdate = storageEntries.filter(([slug, obj]) => {
      const dbNote = dbMap.get(slug);
      return dbNote !== undefined && !obj.etag.equals(dbNote.etag);
    });
    const toDelete = [...dbMap.entries()].filter(
      ([slug]) => !storageMap.has(slug),
    );

    for (const [slug, storageObj] of toAdd) {
      await this.processUpsert(slug, storageObj);
    }

    for (const [slug, storageObj] of toUpdate) {
      await this.processUpsert(slug, storageObj);
    }

    for (const [slug] of toDelete) {
      await this.commandRepository.deleteBySlug(NoteSlug.create(slug));
    }

    return {
      added: toAdd.length,
      updated: toUpdate.length,
      deleted: toDelete.length,
    };
  }

  private async processUpsert(
    slug: string,
    storageObj: StoredObjectListItem,
  ): Promise<void> {
    const content = await this.storage.get(storageObj.objectKey);
    if (!content) return;

    const text = await new Response(content.body).text();
    const noteSlug = NoteSlug.create(slug);
    const metadata = parseNoteContent(text, noteSlug);

    const note = Note.create({
      title: metadata.title,
      slug: noteSlug,
      etag: content.etag,
      imageUrl: metadata.imageUrl,
      publishedOn: metadata.publishedOn,
      lastModifiedOn: metadata.lastModifiedOn,
    });

    await this.commandRepository.upsert(note);
  }

  private static extractSlug(objectKeyValue: string): string {
    return objectKeyValue.replace(/\.md$/, "");
  }
}
