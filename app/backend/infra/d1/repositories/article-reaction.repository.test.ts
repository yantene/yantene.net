import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import { D1ArticleReactionCommandRepository } from "./article-reaction.command-repository";
import { D1ArticleReactionQueryRepository } from "./article-reaction.query-repository";
import { D1ArticleCommandRepository } from "./article.command-repository";
import { Article, ArticleSlug, ArticleTitle } from "~/backend/domain/article";
import { ReactionEmoji } from "~/backend/domain/article-reaction";
import {
  logScoreAfterReaction,
  reactionWeightLog,
  viewWeightLog,
} from "~/backend/domain/article-view";
import { createTestD1, readViewLogScore } from "~/backend/infra/d1/test-helper";

const LIKE = ReactionEmoji.like();
const PARTY = ReactionEmoji.create("🎉");
const PUBLISHED_ON = "2026-01-15";
const REACTED_ON = "2026-02-01";

/** リアクションを付ける先の記事を 1 本用意する。 */
async function setup(): Promise<{
  d1: D1Database;
  articleId: string;
  commands: D1ArticleReactionCommandRepository;
  queries: D1ArticleReactionQueryRepository;
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
      sourceHash: "hash-0",
    }),
  );

  return {
    d1,
    articleId: article.id,
    commands: new D1ArticleReactionCommandRepository(d1),
    queries: new D1ArticleReactionQueryRepository(d1),
  };
}

describe("D1ArticleReactionCommandRepository", () => {
  it("行が無ければ 1 で作り、あれば足す", async () => {
    const { articleId, commands, queries } = await setup();

    await commands.increment(articleId, LIKE);
    await commands.increment(articleId, LIKE);

    expect(await queries.listByArticleId(articleId)).toEqual([{ emoji: "❤️", count: 2 }]);
  });

  it("絵文字ごとに別の行として数える", async () => {
    const { articleId, commands, queries } = await setup();

    await commands.increment(articleId, LIKE);
    await commands.increment(articleId, PARTY);
    await commands.increment(articleId, PARTY);

    // 多い順。同数のときは絵文字の昇順で、読むたびに入れ替わらない。
    expect(await queries.listByArticleId(articleId)).toEqual([
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

    await commands.increment(articleId, LIKE);
    await commands.decrement(articleId, LIKE);
    await commands.decrement(articleId, LIKE);

    // 0 になった行は一覧に出さない。
    expect(await queries.listByArticleId(articleId)).toEqual([]);
  });

  it("押されていない記事は空を返す", async () => {
    const { articleId, queries } = await setup();

    expect(await queries.listByArticleId(articleId)).toEqual([]);
  });

  it("スコアの足し引きは記事の列を触る", async () => {
    const { d1, articleId, commands } = await setup();
    // 出発点は投稿日の重み (upsert がそこから始めている)。
    const start = viewWeightLog(PUBLISHED_ON);

    await commands.addLogScore(articleId, reactionWeightLog(REACTED_ON));

    expect(await readViewLogScore(d1, articleId)).toBe(logScoreAfterReaction(start, REACTED_ON));

    await commands.subtractLogScore(articleId, reactionWeightLog(REACTED_ON), start);

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
      commands.addLogScore(articleId, weight),
      commands.addLogScore(articleId, weight),
    ]);

    expect(await readViewLogScore(d1, articleId)).toBeCloseTo(
      logScoreAfterReaction(logScoreAfterReaction(start, REACTED_ON), REACTED_ON),
      12,
    );
  });

  it("記事の投稿日を読む。無い記事は undefined", async () => {
    const { articleId, commands } = await setup();

    // 取り消しの下限を出すのに要る。重みに直すのはドメインの仕事なので日付のまま返す。
    expect(await commands.findPublishedOn(articleId)).toBe(PUBLISHED_ON);
    expect(await commands.findPublishedOn("missing")).toBeUndefined();
  });
});
