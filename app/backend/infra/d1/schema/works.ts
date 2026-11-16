import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * 作ったもののメタデータインデックス。原文は git のコンテンツリポジトリに、
 * 詳しい説明 (MDAST) と画像は R2 にあり、この表が持つのは `/about` と `/works` が
 * 本文を読まずに並べるためのものだけ (ADR 0042)。
 *
 * - position: 並び順。書き手がフロントマターに書いた数をそのまま入れる。日付では
 *   並べない (作った順に並べると年表になる)
 * - url: 作品そのものの在り処。外に出していない作品もあるので NULL を取る
 * - stack: 使った技術の名前の並び。JSON の配列を文字列で持つ。引くときに絞らない
 *   (札として出すだけ) ので、子の表にはしない
 * - period_from / period_until: 作った時期。書き手が書いた字 (`2024` / `2024-06` /
 *   `2024-06-04`) のまま持つ。**並べ替えには使わない** (並びは position)。書いて
 *   いなければ両方 NULL、終わりを書いていなければ period_until だけ NULL
 * - role: 自分の役割 (1 行)。書いていなければ NULL
 * - featured: 目立たせたい作品の印 (真偽値)
 * - source_hash: コンテンツリポジトリのリビジョン識別子 (Markdown + アセットの合成
 *   ハッシュ)。refresh の変更検出に使う。既定の空ハッシュは次回 refresh で必ず
 *   不一致になる (書き損じた行が「同じ内容」として素通りしない)
 * - created_at / updated_at: D1 行の作成・更新時刻 (Unix 秒)
 */
export const works = sqliteTable(
  "works",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    summary: text("summary").notNull(),
    url: text("url"),
    position: integer("position").notNull(),
    stack: text("stack").notNull().default("[]"),
    periodFrom: text("period_from"),
    periodUntil: text("period_until"),
    role: text("role"),
    featured: integer("featured", { mode: "boolean" }).notNull().default(false),
    sourceHash: text("source_hash").notNull().default(""),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  // 一覧は常にこの順で引く。件数は少ないが、並びが索引に載っていれば
  // 「どの順で出るのか」がスキーマから読める。
  (table) => [index("works_position_idx").on(table.position)],
);

/**
 * 作品のスクリーンショット。書いた順 (`position`) に `/works/<slug>` の頭に並ぶ。
 *
 * - src: アセット API の URL (`/api/v1/works/<slug>/assets/<path>`)。同期のときに解決して
 *   入れるので、描く側はそのまま `src` に置ける
 * - alt: 何が写っているか。省略を許さない (無ければ作品ごと同期しない)
 * - kind: `desktop` / `mobile`。枠の比率を決める
 * - width / height: 画像の寸法。同期のときにヘッダーから読む。判別できない形式では NULL
 *   (誤った寸法で見た目を壊すより、付けないほうが安全)
 *
 * 差分は取らず、作品を書き込むたびに消してから入れ直す。works への FK は cascade だが、
 * D1 は FK 強制が既定で無効なので、消すときはリポジトリが明示的に掃除する。
 */
export const workScreenshots = sqliteTable(
  "work_screenshots",
  {
    workId: text("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    src: text("src").notNull(),
    alt: text("alt").notNull(),
    kind: text("kind").notNull().default("desktop"),
    width: integer("width"),
    height: integer("height"),
  },
  (table) => [primaryKey({ columns: [table.workId, table.position] })],
);

/**
 * 作品と、それについて書いた記事のつながり。書いた順 (`position`) に並ぶ。
 *
 * **記事の id ではなく slug で持つ。** 同期の順番 (作品が先か記事が先か) に引きずられない
 * ためで、まだ無い記事の slug も入る。**読み手に見せてよいかはここでは決めない。** 描画の
 * たびに記事の読み手向けの読み口で引き直す (同期のときに解決すると、あとで記事を下書きに
 * 戻したときに作品のページから漏れる)。だから articles への FK は張らない。
 *
 * article_slug の索引は、記事の側から「この記事で扱った作品」を逆に引くため。
 */
export const workArticles = sqliteTable(
  "work_articles",
  {
    workId: text("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    articleSlug: text("article_slug").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workId, table.position] }),
    index("work_articles_article_slug_idx").on(table.articleSlug),
  ],
);
