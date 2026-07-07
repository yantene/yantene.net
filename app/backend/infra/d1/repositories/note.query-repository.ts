import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  inArray,
  ne,
  sql,
  type SQL,
} from "drizzle-orm";
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

  async findRelated(
    slug: NoteSlug,
    tags: readonly NoteTag[],
    limit: number,
  ): Promise<readonly Note[]> {
    if (tags.length === 0) return [];
    const tagValues = tags.map((tag) => tag.toString());
    const slugValue = slug.toString();
    const overlap = count(noteTags.tag);
    const rows = await this.db
      .select({ ...getTableColumns(notes), overlap })
      .from(notes)
      .innerJoin(noteTags, eq(noteTags.noteId, notes.id))
      .where(and(inArray(noteTags.tag, tagValues), ne(notes.slug, slugValue)))
      .groupBy(notes.id)
      // 重複数の降順 → 公開日の降順 → slug 昇順 (決定的なタイブレーカ)。
      .orderBy(desc(overlap), desc(notes.publishedOn), asc(notes.slug))
      .limit(limit);

    const tagsByNote = await this.loadTags(rows.map((row) => row.id));
    return rows.map((row) => rowToNote(row, tagsByNote.get(row.id) ?? []));
  }

  async search(query: string, limit: number): Promise<readonly Note[]> {
    const trimmed = query.trim();
    if (trimmed.length === 0) return [];

    // 索引 (notes_fts) は infra が実行時生成する仮想テーブル。未構築なら空を返す。
    let ranked: { slug: string }[];
    try {
      if (trimmed.length < 3) {
        // trigram は 3-gram なので 2 文字以下は MATCH で拾えない。LIKE 部分一致で
        // 補う (小規模コーパスなので全走査で十分)。エスケープ文字は ~ を使う。
        const escaped = trimmed.replaceAll(
          /[~%_]/g,
          (character) => `~${character}`,
        );
        const like = `%${escaped}%`;
        ranked = await this.db.all<{ slug: string }>(
          sql`SELECT slug FROM notes_fts WHERE title LIKE ${like} ESCAPE '~' OR body LIKE ${like} ESCAPE '~' LIMIT ${limit}`,
        );
      } else {
        // クエリ全体を 1 個の FTS5 文字列トークンとして扱う (二重引用符はエスケープ)。
        const match = `"${trimmed.replaceAll('"', '""')}"`;
        ranked = await this.db.all<{ slug: string }>(
          sql`SELECT slug FROM notes_fts WHERE notes_fts MATCH ${match} ORDER BY bm25(notes_fts) LIMIT ${limit}`,
        );
      }
    } catch {
      return [];
    }
    const slugs = ranked.map((row) => row.slug);
    if (slugs.length === 0) return [];

    const rows = await this.db
      .select()
      .from(notes)
      .where(inArray(notes.slug, slugs));
    const tagsByNote = await this.loadTags(rows.map((row) => row.id));
    const bySlug = new Map(
      rows.map((row) => [
        row.slug,
        rowToNote(row, tagsByNote.get(row.id) ?? []),
      ]),
    );
    // bm25 の並び順を保って返す。
    return slugs
      .map((slug) => bySlug.get(slug))
      .filter((note): note is Note => note !== undefined);
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
