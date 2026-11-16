CREATE TABLE `content_reactions` (
	`kind` text NOT NULL,
	`content_id` text NOT NULL,
	`emoji` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`kind`, `content_id`, `emoji`)
);
--> statement-breakpoint
CREATE TABLE `content_views` (
	`kind` text NOT NULL,
	`content_id` text NOT NULL,
	`view_count` integer DEFAULT 0 NOT NULL,
	`view_log_score` real DEFAULT 0 NOT NULL,
	PRIMARY KEY(`kind`, `content_id`)
);
--> statement-breakpoint
CREATE INDEX `content_views_view_log_score_idx` ON `content_views` (`view_log_score`);--> statement-breakpoint
-- ここから下は手で足した。上は drizzle-kit が生成した表と索引で、下は今の値の写し。
-- 旧い表 (article_reactions) と articles の列は落とさない。書き込みは新旧の両方へ入り、
-- 読み出しは新しい表から行う (#566)。
--
-- 閲覧数は status を問わず全記事を写す。人気順は content_views と結合して並べるので、
-- 行の無い記事は、あとで公開しても順位に出てこない。
INSERT INTO `content_views` (`kind`, `content_id`, `view_count`, `view_log_score`)
SELECT 'article', `id`, `view_count`, `view_log_score` FROM `articles`;
--> statement-breakpoint
-- リアクションは 0 の行も写す (取り消しで 0 になった行は残す作りなので、姿を変えない)。
-- 指す記事がもう無い行は写さない。
INSERT INTO `content_reactions` (`kind`, `content_id`, `emoji`, `count`)
SELECT 'article', `article_id`, `emoji`, `count` FROM `article_reactions`
WHERE `article_id` IN (SELECT `id` FROM `articles`);
