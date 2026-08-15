import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import { D1NoteReactionCommandRepository } from "./note-reaction.command-repository";
import { D1NoteReactionQueryRepository } from "./note-reaction.query-repository";
import { D1NoteCommandRepository } from "./note.command-repository";
import { Note, NoteSlug, NoteTitle } from "~/backend/domain/note";
import { ReactionEmoji } from "~/backend/domain/note-reaction";
import {
  logScoreAfterReaction,
  reactionWeightLog,
  viewWeightLog,
} from "~/backend/domain/note-view";
import { createTestD1, readViewLogScore } from "~/backend/infra/d1/test-helper";

const LIKE = ReactionEmoji.like();
const PARTY = ReactionEmoji.create("🎉");
const PUBLISHED_ON = "2026-01-15";
const REACTED_ON = "2026-02-01";

/** リアクションを付ける先の記事を 1 本用意する。 */
async function setup(): Promise<{
  d1: D1Database;
  noteId: string;
  commands: D1NoteReactionCommandRepository;
  queries: D1NoteReactionQueryRepository;
}> {
  const d1 = createTestD1();
  const note = await new D1NoteCommandRepository(d1).upsert(
    Note.create({
      slug: NoteSlug.create("alpha"),
      title: NoteTitle.create("Alpha"),
      summary: "summary",
      imageUrl: undefined,
      publishedOn: Temporal.PlainDate.from(PUBLISHED_ON),
      lastModifiedOn: Temporal.PlainDate.from(PUBLISHED_ON),
      sourceHash: "hash-0",
    }),
  );

  return {
    d1,
    noteId: note.id,
    commands: new D1NoteReactionCommandRepository(d1),
    queries: new D1NoteReactionQueryRepository(d1),
  };
}

describe("D1NoteReactionCommandRepository", () => {
  it("行が無ければ 1 で作り、あれば足す", async () => {
    const { noteId, commands, queries } = await setup();

    await commands.increment(noteId, LIKE);
    await commands.increment(noteId, LIKE);

    expect(await queries.listByNoteId(noteId)).toEqual([
      { emoji: "❤️", count: 2 },
    ]);
  });

  it("絵文字ごとに別の行として数える", async () => {
    const { noteId, commands, queries } = await setup();

    await commands.increment(noteId, LIKE);
    await commands.increment(noteId, PARTY);
    await commands.increment(noteId, PARTY);

    // 多い順。同数のときは絵文字の昇順で、読むたびに入れ替わらない。
    expect(await queries.listByNoteId(noteId)).toEqual([
      { emoji: "🎉", count: 2 },
      { emoji: "❤️", count: 1 },
    ]);
  });

  /*
   * 押していない人からの取り消しが届いても、数を負にしない。押したかどうかはセッションが
   * 持つが、記録が消えている相手もいる。
   */
  it("0 を下回らせない", async () => {
    const { noteId, commands, queries } = await setup();

    await commands.increment(noteId, LIKE);
    await commands.decrement(noteId, LIKE);
    await commands.decrement(noteId, LIKE);

    // 0 になった行は一覧に出さない。
    expect(await queries.listByNoteId(noteId)).toEqual([]);
  });

  it("押されていない記事は空を返す", async () => {
    const { noteId, queries } = await setup();

    expect(await queries.listByNoteId(noteId)).toEqual([]);
  });

  it("スコアの足し引きは記事の列を触る", async () => {
    const { d1, noteId, commands } = await setup();
    // 出発点は投稿日の重み (upsert がそこから始めている)。
    const start = viewWeightLog(PUBLISHED_ON);

    await commands.addLogScore(noteId, reactionWeightLog(REACTED_ON));

    expect(await readViewLogScore(d1, noteId)).toBe(
      logScoreAfterReaction(start, REACTED_ON),
    );

    await commands.subtractLogScore(
      noteId,
      reactionWeightLog(REACTED_ON),
      start,
    );

    expect(await readViewLogScore(d1, noteId)).toBeCloseTo(start, 10);
  });

  /*
   * 読んでから書き戻す 2 手だと、間に別の書き込みが挟まったときに片方の加算が
   * まるごと消える (#258)。今の値に足すところまで SQL に任せて取りこぼさない。
   */
  it("同じ記事に同時に押されても、どちらの加算も消えない", async () => {
    const { d1, noteId, commands } = await setup();
    const start = viewWeightLog(PUBLISHED_ON);
    const weight = reactionWeightLog(REACTED_ON);

    await Promise.all([
      commands.addLogScore(noteId, weight),
      commands.addLogScore(noteId, weight),
    ]);

    expect(await readViewLogScore(d1, noteId)).toBeCloseTo(
      logScoreAfterReaction(
        logScoreAfterReaction(start, REACTED_ON),
        REACTED_ON,
      ),
      12,
    );
  });

  it("記事の投稿日を読む。無い記事は undefined", async () => {
    const { noteId, commands } = await setup();

    // 取り消しの下限を出すのに要る。重みに直すのはドメインの仕事なので日付のまま返す。
    expect(await commands.findPublishedOn(noteId)).toBe(PUBLISHED_ON);
    expect(await commands.findPublishedOn("missing")).toBeUndefined();
  });
});
