import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import { D1NoteReactionCommandRepository } from "./note-reaction.command-repository";
import { D1NoteViewCommandRepository } from "./note-view.command-repository";
import { D1NoteCommandRepository } from "./note.command-repository";
import { Note, NoteSlug, NoteTitle } from "~/backend/domain/note";
import {
  logScoreAfterReaction,
  logScoreAfterView,
  reactionWeightLog,
  viewWeightLog,
} from "~/backend/domain/note-view";
import { createTestD1, readViewLogScore } from "~/backend/infra/d1/test-helper";

const PUBLISHED_ON = "2026-01-15";
const VIEWED_ON = "2026-02-01";

interface Harness {
  readonly d1: D1Database;
  readonly noteId: string;
  readonly views: D1NoteViewCommandRepository;
  readonly reactions: D1NoteReactionCommandRepository;
}

async function setup(): Promise<Harness> {
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
    views: new D1NoteViewCommandRepository(d1),
    reactions: new D1NoteReactionCommandRepository(d1),
  };
}

async function readViewCount(harness: Harness): Promise<number | undefined> {
  const row = await harness.d1
    .prepare("SELECT view_count AS count FROM notes WHERE id = ?")
    .bind(harness.noteId)
    .first<{ count: number }>();

  return row?.count;
}

describe("閲覧の記録", () => {
  it("累計を 1 増やし、対数スコアにその日の重みを足す", async () => {
    const harness = await setup();
    // 出発点は投稿日の重み (upsert がそこから始めている)。
    const start = viewWeightLog(PUBLISHED_ON);

    await harness.views.addView(harness.noteId, viewWeightLog(VIEWED_ON));

    expect(await readViewCount(harness)).toBe(1);
    expect(await readViewLogScore(harness.d1, harness.noteId)).toBe(
      logScoreAfterView(start, VIEWED_ON),
    );
  });

  it("無い記事に足しても何も起きない", async () => {
    const harness = await setup();

    await harness.views.addView("missing", viewWeightLog(VIEWED_ON));

    // 元の記事は巻き込まれない。
    expect(await readViewCount(harness)).toBe(0);
    expect(await readViewLogScore(harness.d1, "missing")).toBeUndefined();
  });

  /*
   * 読んでから書き戻す 2 手だと、間に別の書き込みが挟まったときに片方の加算が
   * まるごと消える (#258)。実測では 15 回のうち 4.6 回ぶんが消えていた。
   * 累計と同じく、対数スコアも今の値から SQL 側で作らせることで取りこぼさない。
   */
  it("同じ記事が同時に読まれても、どちらの加算も消えない", async () => {
    const harness = await setup();
    const start = viewWeightLog(PUBLISHED_ON);
    const weight = viewWeightLog(VIEWED_ON);

    await Promise.all([
      harness.views.addView(harness.noteId, weight),
      harness.views.addView(harness.noteId, weight),
    ]);

    expect(await readViewCount(harness)).toBe(2);
    expect(await readViewLogScore(harness.d1, harness.noteId)).toBeCloseTo(
      logScoreAfterView(logScoreAfterView(start, VIEWED_ON), VIEWED_ON),
      12,
    );
  });

  /* 閲覧とリアクションは同じ列を触るので、種類をまたいでも交差する。 */
  it("閲覧とリアクションが交差しても、どちらの加算も消えない", async () => {
    const harness = await setup();
    const start = viewWeightLog(PUBLISHED_ON);

    await Promise.all([
      harness.views.addView(harness.noteId, viewWeightLog(VIEWED_ON)),
      harness.reactions.addLogScore(
        harness.noteId,
        reactionWeightLog(VIEWED_ON),
      ),
    ]);

    expect(await readViewLogScore(harness.d1, harness.noteId)).toBeCloseTo(
      logScoreAfterReaction(logScoreAfterView(start, VIEWED_ON), VIEWED_ON),
      12,
    );
  });
});
