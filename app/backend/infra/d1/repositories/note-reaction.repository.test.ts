import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import { D1NoteReactionCommandRepository } from "./note-reaction.command-repository";
import { D1NoteReactionQueryRepository } from "./note-reaction.query-repository";
import { D1NoteCommandRepository } from "./note.command-repository";
import { Note, NoteSlug, NoteTitle } from "~/backend/domain/note";
import { ReactionEmoji } from "~/backend/domain/note-reaction";
import { viewWeightLog } from "~/backend/domain/note-view";
import { createTestD1 } from "~/backend/infra/d1/test-helper";

const LIKE = ReactionEmoji.like();
const PARTY = ReactionEmoji.create("🎉");

/** リアクションを付ける先の記事を 1 本用意する。 */
async function setup(): Promise<{
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
      publishedOn: Temporal.PlainDate.from("2026-01-15"),
      lastModifiedOn: Temporal.PlainDate.from("2026-01-15"),
      sourceHash: "hash-0",
    }),
  );

  return {
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

  it("スコアの読み書きは記事の列を触る", async () => {
    const { noteId, commands } = await setup();

    // 出発点は投稿日の重み (upsert がそこから始めている)。
    expect(await commands.findLogScore(noteId)).toBe(
      viewWeightLog("2026-01-15"),
    );

    await commands.applyLogScore(noteId, 1.5);

    expect(await commands.findLogScore(noteId)).toBe(1.5);
  });

  it("無い記事のスコアは undefined", async () => {
    const { commands } = await setup();

    expect(await commands.findLogScore("missing")).toBeUndefined();
  });
});
