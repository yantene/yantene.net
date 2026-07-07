import type {
  INoteSearchIndex,
  NoteSearchDocument,
  NoteSlug,
} from "~/backend/domain/note";

/**
 * FTS5 (trigram) の検索インデックス。日本語の substring 検索に対応する。
 * Drizzle では仮想テーブルを表現できないため、マイグレーションではなく実行時に
 * `CREATE VIRTUAL TABLE IF NOT EXISTS` で用意する (infra が管理する索引)。
 */
const CREATE_TABLE =
  "CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(slug UNINDEXED, title, body, tokenize = 'trigram')";

export class D1NoteSearchIndex implements INoteSearchIndex {
  constructor(private readonly d1: D1Database) {}

  private async ensureTable(): Promise<void> {
    await this.d1.exec(CREATE_TABLE);
  }

  async index(document: NoteSearchDocument): Promise<void> {
    await this.ensureTable();
    const slug = document.slug.toString();
    // 置き換え (delete → insert) を 1 バッチで原子的に行う。
    await this.d1.batch([
      this.d1.prepare("DELETE FROM notes_fts WHERE slug = ?").bind(slug),
      this.d1
        .prepare("INSERT INTO notes_fts (slug, title, body) VALUES (?, ?, ?)")
        .bind(slug, document.title, document.body),
    ]);
  }

  async remove(slug: NoteSlug): Promise<void> {
    await this.ensureTable();
    await this.d1
      .prepare("DELETE FROM notes_fts WHERE slug = ?")
      .bind(slug.toString())
      .run();
  }
}
