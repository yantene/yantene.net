ALTER TABLE `notes` ADD `view_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `notes` ADD `view_log_score` real DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `notes_view_log_score_idx` ON `notes` (`view_log_score`);--> statement-breakpoint
-- 既にある記事の出発点を、その記事の投稿日の重みにする。
-- 30.0 は半減期 (日)、0.6931471805599453 は ln(2)。どちらも
-- app/backend/domain/note-view/view-ranking.ts の定数と一致させること。
-- 冪乗は D1 で使えないが、対数のまま持つので掛け算だけで足りる。
UPDATE `notes` SET `view_log_score` =
  (julianday(`published_on`) - julianday('2000-01-01')) / 30.0 * 0.6931471805599453;
