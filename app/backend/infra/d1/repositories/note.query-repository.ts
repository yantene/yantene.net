import { asc, count, desc, eq, inArray, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { rowToNote } from "./note-row";
import type {
  INoteQueryRepository,
  Note,
  NoteListQuery,
  NoteListResult,
  NoteSlug,
  NoteSortField,
  NoteTagCount,
} from "~/backend/domain/note";
import { NoteTag } from "~/backend/domain/note";
import { noteTags, notes } from "~/backend/infra/d1/schema";

const sortColumns = {
  publishedOn: notes.publishedOn,
  lastModifiedOn: notes.lastModifiedOn,
} as const satisfies Record<NoteSortField, unknown>;

export class D1NoteQueryRepository implements INoteQueryRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  async findBySlug(slug: NoteSlug): Promise<Note | undefined> {
    const rows = await this.db
      .select()
      .from(notes)
      .where(eq(notes.slug, slug.toString()))
      .limit(1);
    const row = rows.at(0);
    if (row === undefined) return undefined;
    const tags = await this.loadTags([row.id]);
    return rowToNote(row, tags.get(row.id) ?? []);
  }

  async list(query: NoteListQuery): Promise<NoteListResult> {
    // タグ絞り込み: そのタグを持つノート id に限定する。
    const filter: SQL | undefined =
      query.tag === undefined
        ? undefined
        : inArray(
            notes.id,
            this.db
              .select({ id: noteTags.noteId })
              .from(noteTags)
              .where(eq(noteTags.tag, query.tag)),
          );

    const column = sortColumns[query.sortBy];
    const primary = query.direction === "asc" ? asc(column) : desc(column);
    // 同じ日付のノート同士でも順序を安定させる決定的なタイブレーカ。slug は UNIQUE
    // なので offset ページネーションで行の重複・欠落が起きない。
    const tiebreaker = asc(notes.slug);

    // 行取得と総件数取得は独立なので並行実行する (公開一覧のホットパスの往復を半減)。
    const [rows, [{ value: total }]] = await Promise.all([
      this.db
        .select()
        .from(notes)
        .where(filter)
        .orderBy(primary, tiebreaker)
        .limit(query.limit)
        .offset(query.offset),
      this.db.select({ value: count() }).from(notes).where(filter),
    ]);

    const tagsByNote = await this.loadTags(rows.map((row) => row.id));
    return {
      notes: rows.map((row) => rowToNote(row, tagsByNote.get(row.id) ?? [])),
      total,
    };
  }

  async listTags(): Promise<readonly NoteTagCount[]> {
    const rows = await this.db
      .select({ tag: noteTags.tag, value: count() })
      .from(noteTags)
      .groupBy(noteTags.tag)
      .orderBy(desc(count()), asc(noteTags.tag));
    return rows.map((row) => ({ tag: row.tag, count: row.value }));
  }

  async listSourceHashes(): Promise<ReadonlyMap<string, string>> {
    const rows = await this.db
      .select({ slug: notes.slug, sourceHash: notes.sourceHash })
      .from(notes);
    return new Map(rows.map((row) => [row.slug, row.sourceHash]));
  }

  /** 指定ノート群のタグを id → NoteTag[] にまとめて読み込む。 */
  private async loadTags(
    noteIds: readonly string[],
  ): Promise<Map<string, NoteTag[]>> {
    const map = new Map<string, NoteTag[]>();
    if (noteIds.length === 0) return map;
    const rows = await this.db
      .select({ noteId: noteTags.noteId, tag: noteTags.tag })
      .from(noteTags)
      .where(inArray(noteTags.noteId, [...noteIds]))
      .orderBy(asc(noteTags.tag));
    for (const row of rows) {
      const list = map.get(row.noteId) ?? [];
      list.push(NoteTag.create(row.tag));
      map.set(row.noteId, list);
    }
    return map;
  }
}
