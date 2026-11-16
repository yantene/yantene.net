import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import { D1ContentReactionCommandRepository } from "./content-reaction.command-repository";
import { D1ContentReactionQueryRepository } from "./content-reaction.query-repository";
import { D1ArticleCommandRepository } from "./article.command-repository";
import { Article, ArticleSlug, ArticleTitle } from "~/backend/domain/article";
import { ReactionEmoji } from "~/backend/domain/content-reaction";
import { articleRef } from "~/backend/domain/shared";
import {
  logScoreAfterReaction,
  reactionWeightLog,
  viewWeightLog,
} from "~/backend/domain/content-view";
import {
  createTestD1,
  readLegacyViewLogScore,
  readViewLogScore,
} from "~/backend/infra/d1/test-helper";

const LIKE = ReactionEmoji.like();
const PARTY = ReactionEmoji.create("🎉");
const PUBLISHED_ON = "2026-01-15";
const REACTED_ON = "2026-02-01";

/** リアクションを付ける先の記事を 1 本用意する。 */
async function setup(): Promise<{
  d1: D1Database;
  articleId: string;
  commands: D1ContentReactionCommandRepository;
  queries: D1ContentReactionQueryRepository;
}> {
  const d1 = createTestD1();
  const article = await new D1ArticleCommandRepository(d1).upsert(
    Article.create({
      slug: ArticleSlug.create("alpha"),
      title: ArticleTitle.create("Alpha"),
      summary: "summary",
      imageUrl: undefined,
      publishedOn: Temporal.PlainDate.from(PUBLISHED_ON),
      lastModifiedOn: Temporal.PlainDate.from(PUBLISHED_ON),
      status: "published",
      sourceHash: "hash-0",
    }),
  );

  return {
    d1,
    articleId: article.id,
    commands: new D1ContentReactionCommandRepository(d1),
    queries: new D1ContentReactionQueryRepository(d1),
  };
}

describe("D1ContentReactionCommandRepository", () => {
  it("行が無ければ 1 で作り、あれば足す", async () => {
    const { articleId, commands, queries } = await setup();

    await commands.increment(articleRef(articleId), LIKE);
    await commands.increment(articleRef(articleId), LIKE);

    expect(await queries.listByContent(articleRef(articleId))).toEqual([{ emoji: "❤️", count: 2 }]);
  });

  it("絵文字ごとに別の行として数える", async () => {
    const { articleId, commands, queries } = await setup();

    await commands.increment(articleRef(articleId), LIKE);
    await commands.increment(articleRef(articleId), PARTY);
    await commands.increment(articleRef(articleId), PARTY);

    // 多い順。同数のときは絵文字の昇順で、読むたびに入れ替わらない。
    expect(await queries.listByContent(articleRef(articleId))).toEqual([
      { emoji: "🎉", count: 2 },
      { emoji: "❤️", count: 1 },
    ]);
  });

  /*
   * 押していない人からの取り消しが届いても、数を負にしない。押したかどうかはセッションが
   * 持つが、記録が消えている相手もいる。
   */
  it("0 を下回らせない", async () => {
    const { articleId, commands, queries } = await setup();

    await commands.increment(articleRef(articleId), LIKE);
    await commands.decrement(articleRef(articleId), LIKE);
    await commands.decrement(articleRef(articleId), LIKE);

    // 0 になった行は一覧に出さない。
    expect(await queries.listByContent(articleRef(articleId))).toEqual([]);
  });

  it("押されていない記事は空を返す", async () => {
    const { articleId, queries } = await setup();

    expect(await queries.listByContent(articleRef(articleId))).toEqual([]);
  });

  it("スコアの足し引きは閲覧数と同じ列を触る", async () => {
    const { d1, articleId, commands } = await setup();
    // 出発点は投稿日の重み (upsert がそこから始めている)。
    const start = viewWeightLog(PUBLISHED_ON);

    await commands.addLogScore(articleRef(articleId), reactionWeightLog(REACTED_ON));

    expect(await readViewLogScore(d1, articleId)).toBe(logScoreAfterReaction(start, REACTED_ON));

    await commands.subtractLogScore(articleRef(articleId), reactionWeightLog(REACTED_ON), start);

    expect(await readViewLogScore(d1, articleId)).toBeCloseTo(start, 10);
  });

  /*
   * 読んでから書き戻す 2 手だと、間に別の書き込みが挟まったときに片方の加算が
   * まるごと消える (#258)。今の値に足すところまで SQL に任せて取りこぼさない。
   */
  it("同じ記事に同時に押されても、どちらの加算も消えない", async () => {
    const { d1, articleId, commands } = await setup();
    const start = viewWeightLog(PUBLISHED_ON);
    const weight = reactionWeightLog(REACTED_ON);

    await Promise.all([
      commands.addLogScore(articleRef(articleId), weight),
      commands.addLogScore(articleRef(articleId), weight),
    ]);

    expect(await readViewLogScore(d1, articleId)).toBeCloseTo(
      logScoreAfterReaction(logScoreAfterReaction(start, REACTED_ON), REACTED_ON),
      12,
    );
  });

  it("記事の投稿日を読む。無い記事は undefined", async () => {
    const { articleId, commands } = await setup();

    // 取り消しの下限を出すのに要る。重みに直すのはドメインの仕事なので日付のまま返す。
    expect(await commands.findPublishedOn(articleRef(articleId))).toBe(PUBLISHED_ON);
    expect(await commands.findPublishedOn(articleRef("missing"))).toBeUndefined();
  });

  /*
   * 移行のあいだ、旧い表 (article_reactions) と旧い列 (articles.view_log_score) にも
   * 同じ値を書く (#566)。旧い表を落とすときに、この describe ごと消す。
   */
  describe("旧い表への書き込み", () => {
    async function readLegacyCounts(d1: D1Database, articleId: string): Promise<unknown> {
      const { results } = await d1
        .prepare(
          "SELECT emoji, count FROM article_reactions WHERE article_id = ? ORDER BY count DESC, emoji",
        )
        .bind(articleId)
        .all();
      return results;
    }

    it("数の増減が旧い表にも入る", async () => {
      const { d1, articleId, commands } = await setup();
      const content = articleRef(articleId);

      await commands.increment(content, LIKE);
      await commands.increment(content, LIKE);
      await commands.increment(content, PARTY);
      await commands.decrement(content, PARTY);
      await commands.decrement(content, PARTY);

      expect(await readLegacyCounts(d1, articleId)).toEqual([
        { emoji: "❤️", count: 2 },
        { emoji: "🎉", count: 0 },
      ]);
    });

    it("スコアの足し引きが旧い列にも同じ値で入る", async () => {
      const { d1, articleId, commands } = await setup();
      const content = articleRef(articleId);
      const weight = reactionWeightLog(REACTED_ON);

      await commands.addLogScore(content, weight);
      await commands.addLogScore(content, weight);
      expect(await readLegacyViewLogScore(d1, articleId)).toBe(
        await readViewLogScore(d1, articleId),
      );

      await commands.subtractLogScore(content, weight, viewWeightLog(PUBLISHED_ON));
      expect(await readLegacyViewLogScore(d1, articleId)).toBe(
        await readViewLogScore(d1, articleId),
      );
    });
  });
});
