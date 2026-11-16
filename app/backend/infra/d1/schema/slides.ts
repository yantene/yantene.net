import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * スライドのメタデータインデックス。原文は git のコンテンツリポジトリに、本文 (MDAST) と
 * 画像は R2 にあり、この表が持つのは `/slides` とフィードが本文を読まずに並べるための
 * ものだけ (ADR 0052)。
 *
 * - published_on: 出した日 (`YYYY-MM-DD`)。一覧はこの新しい順に並ぶ
 * - event_name / event_date / event_url: 発表の場。発表しなかったスライドでは 3 つとも
 *   NULL。日付と URL は名前があるときだけ入る (書き込み経路が担保する)
 * - summary: 語り (地の文) の書き出しから作った要約。語りが無ければ空
 * - page_count: ページの数 (表紙と「参考」を含む)。同期のときに本文を切って数える
 * - source_hash: コンテンツリポジトリのリビジョン識別子 (Markdown + アセットの合成
 *   ハッシュ)。refresh の変更検出に使う。既定の空ハッシュは次回 refresh で必ず
 *   不一致になる (書き損じた行が「同じ内容」として素通りしない)
 * - created_at / updated_at: D1 行の作成・更新時刻 (Unix 秒)
 *
 * **公開範囲の列は持たない。** 出したくないものは push しない (作品と同じ決め)。
 */
export const slides = sqliteTable(
  "slides",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    publishedOn: text("published_on").notNull(),
    eventName: text("event_name"),
    eventDate: text("event_date"),
    eventUrl: text("event_url"),
    summary: text("summary").notNull(),
    pageCount: integer("page_count").notNull(),
    sourceHash: text("source_hash").notNull().default(""),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  // 一覧は常にこの順で引く。並びが索引に載っていれば「どの順で出るのか」が
  // スキーマから読める (works と同じ理由)。
  (table) => [index("slides_published_on_idx").on(table.publishedOn)],
);
