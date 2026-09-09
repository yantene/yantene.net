-- 長文の記事を指す note を article に改める (ADR 0032)。
--
-- 表と列は ALTER TABLE ... RENAME で名前だけ変える (行は動かさない)。表を改名すると
-- 他の表の REFERENCES も書き換わる (SQLite 3.26 以降、legacy_alter_table が OFF のとき)。
-- 索引は改名されないので、落として作り直す。
ALTER TABLE `notes` RENAME TO `articles`;--> statement-breakpoint
ALTER TABLE `note_reactions` RENAME TO `article_reactions`;--> statement-breakpoint
ALTER TABLE `note_embeddings` RENAME TO `article_embeddings`;--> statement-breakpoint
ALTER TABLE `note_similarities` RENAME TO `article_similarities`;--> statement-breakpoint
ALTER TABLE `article_reactions` RENAME COLUMN `note_id` TO `article_id`;--> statement-breakpoint
ALTER TABLE `article_embeddings` RENAME COLUMN `note_id` TO `article_id`;--> statement-breakpoint
ALTER TABLE `article_similarities` RENAME COLUMN `note_id` TO `article_id`;--> statement-breakpoint
ALTER TABLE `article_similarities` RENAME COLUMN `other_note_id` TO `other_article_id`;--> statement-breakpoint
ALTER TABLE `webmentions` RENAME COLUMN `note_id` TO `article_id`;--> statement-breakpoint
DROP INDEX `notes_slug_unique`;--> statement-breakpoint
DROP INDEX `notes_view_log_score_idx`;--> statement-breakpoint
DROP INDEX `note_similarities_note_id_similarity_idx`;--> statement-breakpoint
DROP INDEX `webmentions_note_id_source_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `articles_slug_unique` ON `articles` (`slug`);--> statement-breakpoint
CREATE INDEX `articles_view_log_score_idx` ON `articles` (`view_log_score`);--> statement-breakpoint
CREATE INDEX `article_similarities_article_id_similarity_idx` ON `article_similarities` (`article_id`,`similarity`);--> statement-breakpoint
CREATE UNIQUE INDEX `webmentions_article_id_source_idx` ON `webmentions` (`article_id`,`source`);--> statement-breakpoint
-- 検索の索引 (FTS5) は Drizzle の外で infra が実行時に作る (article-search-index.ts)。
-- 表が無い環境 (新規、テスト) でも通るように、同じ定義で作ってから改名する。
CREATE VIRTUAL TABLE IF NOT EXISTS `notes_fts` USING fts5(slug UNINDEXED, title, body, tokenize = 'trigram');--> statement-breakpoint
ALTER TABLE `notes_fts` RENAME TO `articles_fts`;
