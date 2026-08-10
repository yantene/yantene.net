import {
  index,
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

/**
 * ノートのメタデータインデックス。コンテンツ正本は Cloudflare Artifacts、
 * 本文 (MDAST) と画像は R2 にあり、この D1 テーブルは一覧・ルーティング用の
 * メタデータだけを保持する (ADR 0005)。
 *
 * - published_on / last_modified_on: フロントマター由来の日付。ISO 日付文字列
 *   ("YYYY-MM-DD") で保存し、辞書順ソート = 日付順ソートを利用する。
 * - created_at / updated_at: D1 行の作成・更新時刻 (Unix 秒)。コンテンツ日付とは別。
 */
export const notes = sqliteTable(
  "notes",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    imageUrl: text("image_url"),
    publishedOn: text("published_on").notNull(),
    lastModifiedOn: text("last_modified_on").notNull(),
    // コンテンツ正本のリビジョン識別子 (Markdown + アセットの合成ハッシュ)。
    // refresh の変更検出に使う。既存行への ADD COLUMN を安全にするため DEFAULT '' を持つ
    // (空ハッシュは次回 refresh で必ず不一致になり再処理される)。
    sourceHash: text("source_hash").notNull().default(""),
    /*
     * 読まれた回数と、そこから作る人気の目安。
     *
     * 読んだ人を特定できる値は持たない。ここにあるのは「何回読まれたか」だけで、
     * 誰がいつ読んだかは残らない。
     *
     * - view_count: 累計。減らない
     * - view_log_score: 人気の目安 (自然対数)。新しく読まれるほど大きな重みを足して
     *   いくので、素の値なら指数的に膨らんで倍精度でも 85 年ほどで溢れる。対数のまま
     *   持てば経過に対して線形にしか増えず、事実上いつまでも壊れない。対数は単調なので
     *   この列で直接 ORDER BY すれば人気順になる (詳細は domain/note-view/view-ranking)
     *
     * 初期値は 0 で、対数の 0 は素の 1、つまり「基準日に 1 回読まれた」ぶんに当たる。
     * 実際には読まれていないのに 1 回ぶんを置くのは、素の 0 だと対数が -∞ になって
     * しまうため。下限を 1 に引き上げておけば、この列は NULL を取らず、足すときも
     * 読むときも場合分けが要らない。
     *
     * この下駄は全記事に等しく乗るので順位は歪まない。実際に読まれたかどうかは
     * view_count が持つ。
     */
    viewCount: integer("view_count").notNull().default(0),
    viewLogScore: real("view_log_score").notNull().default(0),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    // 人気順は「対数スコアの大きい順に数件」を引くだけなので、この索引で足りる。
    index("notes_view_log_score_idx").on(table.viewLogScore),
  ],
);
