import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * コンテンツが読まれた回数と、そこから作る人気の目安。種別をまたいで 1 つの表に持つ
 * (ADR 0051)。
 *
 * この表が持つのは「何回読まれたか」だけで、誰が読んだかは残らない。読み直しを
 * 数えないための「誰が何を読んだか」はセッション (KV) 側にあり、日ごとに捨てる。
 *
 * - (kind, content_id) の複合主キー。content_id は種別ごとの表 (記事なら articles.id) を指す
 * - **FK は張らない。** 指す先の表が種別で変わるので張れない。指す先を消すときは
 *   Command リポジトリが明示的に掃除する
 * - **指す先 1 つにつき必ず 1 行ある。** 行は指す先を初めて保存するときに一緒に作る。
 *   出発点 (投稿日の重み) は SQL の既定値では書けないので、足すときに無ければ作る形に
 *   できない
 * - view_count: 累計。減らない。同じ人が同じ日に読み直したぶんは含まない
 *   (判定は読み手のセッションで行う。ADR 0011)
 * - view_log_score: 人気の目安 (自然対数)。新しく読まれるほど大きな重みを足して
 *   いくので、素の値なら指数的に膨らんで倍精度でも 85 年ほどで溢れる。対数のまま
 *   持てば経過に対して線形にしか増えず、事実上いつまでも壊れない。対数は単調なので
 *   この列で直接 ORDER BY すれば人気順になる (詳細は domain/content-view/view-ranking)
 *
 * view_log_score の既定の 0 は、対数の 0 = 素の 1、つまり「基準日に 1 回読まれた」ぶんに
 * 当たる。素の 0 だと対数が -∞ になるので、下限を 1 に引き上げてある。この列は NULL を
 * 取らず、足すときも読むときも場合分けが要らない。
 */
export const contentViews = sqliteTable(
  "content_views",
  {
    kind: text("kind").notNull(),
    contentId: text("content_id").notNull(),
    viewCount: integer("view_count").notNull().default(0),
    viewLogScore: real("view_log_score").notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.kind, table.contentId] }),
    // 人気順は「対数スコアの大きい順に数件」。並べ替えに使える索引を置く (使うかは実行計画が決める)。
    index("content_views_view_log_score_idx").on(table.viewLogScore),
  ],
);
