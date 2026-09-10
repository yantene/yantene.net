import type {
  IArticleSearchIndex,
  ArticleSearchDocument,
  ArticleSlug,
} from "~/backend/domain/article";

/**
 * FTS5 (trigram) の検索インデックス。日本語の substring 検索に対応する。
 * Drizzle では仮想テーブルを表現できないため、マイグレーションではなく実行時に
 * `CREATE VIRTUAL TABLE IF NOT EXISTS` で用意する (infra が管理する索引)。
 *
 * ⚠️ 定義を変えるときは `migrations/0011_rename_notes_to_articles.sql` も見ること。
 * 改名のために同じ定義を 1 度だけ持っている (無い環境でも改名を通すため)。
 */
const CREATE_TABLE =
  "CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(slug UNINDEXED, title, body, tokenize = 'trigram')";

export class D1ArticleSearchIndex implements IArticleSearchIndex {
  constructor(private readonly d1: D1Database) {}

  private async ensureTable(): Promise<void> {
    await this.d1.exec(CREATE_TABLE);
  }

  async index(document: ArticleSearchDocument): Promise<void> {
    await this.ensureTable();
    const slug = document.slug.toString();
    // 置き換え (delete → insert) を 1 バッチで原子的に行う。
    await this.d1.batch([
      this.d1.prepare("DELETE FROM articles_fts WHERE slug = ?").bind(slug),
      this.d1
        .prepare("INSERT INTO articles_fts (slug, title, body) VALUES (?, ?, ?)")
        .bind(slug, document.title, document.body),
    ]);
  }

  async remove(slug: ArticleSlug): Promise<void> {
    await this.ensureTable();
    await this.d1.prepare("DELETE FROM articles_fts WHERE slug = ?").bind(slug.toString()).run();
  }
}
