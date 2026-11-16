/// <reference types="node" />
import { readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

/**
 * 反応と閲覧数を種別に依存しない表へ移す migration が、今の値を取りこぼさずに写すこと。
 *
 * ほかのテストは空の DB に migration を当てるので、`INSERT ... SELECT` は 1 行も写さずに
 * 通ってしまう。ここだけは、移す前の姿に行を入れてから当てる。
 *
 * 番号は生成し直すと変わるので、migration は名前の後ろで探す。
 */
const MIGRATION_SUFFIX = "_create_content_reactions_and_views";

const migrationsDir = path.join(import.meta.dirname, "../../../../migrations");

function readTags(): readonly string[] {
  const journal = JSON.parse(
    readFileSync(path.join(migrationsDir, "meta/_journal.json"), "utf8"),
  ) as { entries: { tag: string }[] };
  return journal.entries.map(({ tag }) => tag);
}

function apply(db: DatabaseSync, tag: string): void {
  const statements = readFileSync(path.join(migrationsDir, `${tag}.sql`), "utf8")
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
  for (const statement of statements) db.exec(statement);
}

/** 移す直前の姿の DB と、これから当てる migration の名前。 */
function setupBeforeMigration(): { db: DatabaseSync; target: string } {
  const tags = readTags();
  const target = tags.find((tag) => tag.endsWith(MIGRATION_SUFFIX));
  if (target === undefined) throw new Error(`migration not found: *${MIGRATION_SUFFIX}`);

  // 指す記事の無いリアクションを入れたいので、FK は見張らせない。
  const db = new DatabaseSync(":memory:", { enableForeignKeyConstraints: false });
  for (const tag of tags.slice(0, tags.indexOf(target))) apply(db, tag);

  return { db, target };
}

function insertArticle(
  db: DatabaseSync,
  article: { id: string; status: string; viewCount: number; viewLogScore: number },
): void {
  db.prepare(
    `INSERT INTO articles
       (id, slug, title, summary, published_on, last_modified_on, status,
        view_count, view_log_score, created_at, updated_at)
     VALUES (?, ?, 't', 's', '2026-01-15', '2026-01-15', ?, ?, ?, 0, 0)`,
  ).run(article.id, `slug-${article.id}`, article.status, article.viewCount, article.viewLogScore);
}

function insertReaction(db: DatabaseSync, articleId: string, emoji: string, count: number): void {
  db.prepare("INSERT INTO article_reactions (article_id, emoji, count) VALUES (?, ?, ?)").run(
    articleId,
    emoji,
    count,
  );
}

/** node:sqlite の行は prototype が無いので、比べられる素のオブジェクトに写す。 */
function plain(rows: readonly unknown[]): readonly Record<string, unknown>[] {
  return rows.map((row) => ({ ...(row as Record<string, unknown>) }));
}

describe("反応と閲覧数を写す migration", () => {
  it("閲覧数は status を問わず全記事を、値を変えずに写す", () => {
    const { db, target } = setupBeforeMigration();
    insertArticle(db, { id: "a", status: "published", viewCount: 12, viewLogScore: 231.0625 });
    insertArticle(db, { id: "b", status: "draft", viewCount: 0, viewLogScore: 219.5 });
    insertArticle(db, { id: "c", status: "withdrawn", viewCount: 7, viewLogScore: -3.25 });

    apply(db, target);

    const rows = db
      .prepare(
        "SELECT kind, content_id, view_count, view_log_score FROM content_views ORDER BY content_id",
      )
      .all();
    expect(plain(rows)).toEqual([
      { kind: "article", content_id: "a", view_count: 12, view_log_score: 231.0625 },
      { kind: "article", content_id: "b", view_count: 0, view_log_score: 219.5 },
      { kind: "article", content_id: "c", view_count: 7, view_log_score: -3.25 },
    ]);
  });

  it("リアクションは 0 の行も写し、指す記事が無い行は写さない", () => {
    const { db, target } = setupBeforeMigration();
    insertArticle(db, { id: "a", status: "published", viewCount: 0, viewLogScore: 0 });
    insertReaction(db, "a", "❤️", 3);
    insertReaction(db, "a", "🎉", 0);
    insertReaction(db, "gone", "❤️", 5);

    apply(db, target);

    const rows = db
      .prepare("SELECT kind, content_id, emoji, count FROM content_reactions ORDER BY count DESC")
      .all();
    expect(plain(rows)).toEqual([
      { kind: "article", content_id: "a", emoji: "❤️", count: 3 },
      { kind: "article", content_id: "a", emoji: "🎉", count: 0 },
    ]);
  });

  it("旧い表と列には触らない", () => {
    const { db, target } = setupBeforeMigration();
    insertArticle(db, { id: "a", status: "published", viewCount: 12, viewLogScore: 231.0625 });
    insertReaction(db, "a", "❤️", 3);

    apply(db, target);

    expect(
      plain(db.prepare("SELECT view_count, view_log_score FROM articles WHERE id = 'a'").all()),
    ).toEqual([{ view_count: 12, view_log_score: 231.0625 }]);
    expect(plain(db.prepare("SELECT count FROM article_reactions").all())).toEqual([{ count: 3 }]);
  });
});
