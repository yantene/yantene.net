import { extractSummary } from "../domain/note/extract-summary";
import { markdownToMdast } from "../domain/note/markdown-to-mdast";
import { parseNoteContent } from "../domain/note/note-content.parser";
import { Note } from "../domain/note/note.entity";
import type { RefreshResult } from "./refresh-result";
import type {
  IMarkdownStorage,
  MarkdownListItem,
} from "../domain/note/markdown-storage.interface";
import type { INoteCommandRepository } from "../domain/note/note.command-repository.interface";
import type { INoteQueryRepository } from "../domain/note/note.query-repository.interface";

export class NotesRefreshService {
  constructor(
    private readonly storage: IMarkdownStorage,
    private readonly queryRepository: INoteQueryRepository,
    private readonly commandRepository: INoteCommandRepository,
  ) {}

  async execute(): Promise<RefreshResult> {
    const [markdownFiles, dbNotes] = await Promise.all([
      this.storage.list(),
      this.queryRepository.findAll(),
    ]);

    const storageMap = new Map(
      markdownFiles.map((item) => [item.slug.value, item]),
    );
    const dbMap = new Map(dbNotes.map((note) => [note.slug.value, note]));

    const storageEntries = [...storageMap.entries()];
    const toAdd = storageEntries.filter(([slug]) => !dbMap.has(slug));
    const toUpdate = storageEntries.filter(([slug, item]) => {
      const dbNote = dbMap.get(slug);
      return dbNote !== undefined && !item.etag.equals(dbNote.etag);
    });
    const toDelete = [...dbMap.entries()].filter(
      ([slug]) => !storageMap.has(slug),
    );

    for (const [, item] of toAdd) {
      await this.processUpsert(item);
    }

    for (const [, item] of toUpdate) {
      await this.processUpsert(item);
    }

    for (const [, dbNote] of toDelete) {
      await this.commandRepository.deleteBySlug(dbNote.slug);
    }

    return {
      added: toAdd.length,
      updated: toUpdate.length,
      deleted: toDelete.length,
    };
  }

  private async processUpsert(item: MarkdownListItem): Promise<void> {
    const content = await this.storage.get(item.slug);
    if (!content) return;

    const text = await new Response(content.body).text();
    const metadata = parseNoteContent(text, item.slug);
    const mdast = markdownToMdast(text, item.slug);
    const summary = extractSummary(mdast);

    const note = Note.create({
      title: metadata.title,
      slug: item.slug,
      etag: content.etag,
      imageUrl: metadata.imageUrl,
      summary,
      publishedOn: metadata.publishedOn,
      lastModifiedOn: metadata.lastModifiedOn,
    });

    await this.commandRepository.upsert(note);
  }
}
