import { Temporal } from "@js-temporal/polyfill";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { describe, expect, it } from "vitest";
import { D1NoteCommandRepository } from "./repositories";
import { notes } from "./schema";
import { createTestD1, readViewLogScore } from "./test-helper";
import { scoreWithWeightAdded, scoreWithWeightRemoved } from "./view-log-score";
import { Note, NoteSlug, NoteTitle } from "~/backend/domain/note";
import {
  logScoreAfterReaction,
  logScoreAfterReactionRemoved,
  logScoreAfterView,
  reactionWeightLog,
  VIEW_SCORE_EPOCH,
  VIEW_SCORE_HALF_LIFE_DAYS,
  viewWeightLog,
} from "~/backend/domain/note-view";

/**
 * SQL の式が、ドメインの JS と同じ答えを出すことを固定する。
 *
 * 順位付けの意味を決めているのは domain/note-view/view-ranking で、SQL はその写し。
 * 写しの側が静かにずれると、順位だけが理由もなく変わる。倍精度の最後の 1 ビットまで
 * 一致することを見ているので、丸め方が変わればここが落ちる。
 */

/** 基準日から days 日後の ISO 日付。 */
function dayAfterEpoch(days: number): string {
  const ms = Date.parse(`${VIEW_SCORE_EPOCH}T00:00:00Z`) + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

interface Harness {
  readonly d1: D1Database;
  readonly noteId: string;
  /** 出発点をその値に置き直す。 */
  seed: (logScore: number) => Promise<void>;
  /** 重み 1 つぶんを足す。 */
  add: (weightLog: number) => Promise<void>;
  /** 重み 1 つぶんを引く。 */
  remove: (weightLog: number, floorLogScore: number) => Promise<void>;
  /** いまのスコア。 */
  score: () => Promise<number | undefined>;
}

async function setup(): Promise<Harness> {
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
  const db = drizzle(d1);
  const row = eq(notes.id, note.id);

  return {
    d1,
    noteId: note.id,
    seed: async (logScore) => {
      await db.update(notes).set({ viewLogScore: logScore }).where(row);
    },
    add: async (weightLog) => {
      await db
        .update(notes)
        .set({ viewLogScore: scoreWithWeightAdded(weightLog) })
        .where(row);
    },
    remove: async (weightLog, floorLogScore) => {
      await db
        .update(notes)
        .set({
          viewLogScore: scoreWithWeightRemoved(weightLog, floorLogScore),
        })
        .where(row);
    },
    score: () => readViewLogScore(d1, note.id),
  };
}

describe("scoreWithWeightAdded", () => {
  /*
   * 桁の並びを変えた代表値で突き合わせる。log-sum-exp は大きいほうを括り出す作りなので、
   * どちらが大きいかで通る道が変わる。
   */
  it.each([
    { name: "重みのほうが大きい", seeded: 0, day: dayAfterEpoch(90) },
    { name: "スコアのほうが大きい", seeded: 100, day: dayAfterEpoch(0) },
    {
      name: "同じ大きさ",
      seeded: viewWeightLog(dayAfterEpoch(60)),
      day: dayAfterEpoch(60),
    },
    { name: "どちらも 0", seeded: 0, day: VIEW_SCORE_EPOCH },
    { name: "スコアが負", seeded: -40, day: dayAfterEpoch(500) },
    {
      name: "桁が離れている",
      seeded: viewWeightLog(dayAfterEpoch(0)),
      day: dayAfterEpoch(9000),
    },
  ])("$name とき、ドメインの logScoreAfterView と一致する", async ({ seeded, day }) => {
    const harness = await setup();
    await harness.seed(seeded);

    await harness.add(viewWeightLog(day));

    expect(await harness.score()).toBe(logScoreAfterView(seeded, day));
  });

  it("リアクションの重みでも一致する", async () => {
    const harness = await setup();
    const day = dayAfterEpoch(120);
    await harness.seed(3.5);

    await harness.add(reactionWeightLog(day));

    expect(await harness.score()).toBe(logScoreAfterReaction(3.5, day));
  });

  it("半減期ぶん経った 1 回は、前の 1 回の 2 倍の重みで積まれる", async () => {
    const harness = await setup();
    await harness.seed(0);

    await harness.add(viewWeightLog(dayAfterEpoch(0)));
    const older = Math.exp((await harness.score()) ?? 0) - 1;
    await harness.seed(0);
    await harness.add(viewWeightLog(dayAfterEpoch(VIEW_SCORE_HALF_LIFE_DAYS)));
    const newer = Math.exp((await harness.score()) ?? 0) - 1;

    expect(newer / older).toBeCloseTo(2, 6);
  });
});

describe("scoreWithWeightRemoved", () => {
  it.each([
    { name: "素直に引ける", seeded: 10, day: dayAfterEpoch(60), floor: -2 },
    {
      name: "引く側のほうが大きい",
      seeded: 0.5,
      day: dayAfterEpoch(300),
      floor: -2,
    },
    {
      name: "引く側とちょうど同じ",
      seeded: reactionWeightLog(dayAfterEpoch(200)),
      day: dayAfterEpoch(200),
      floor: -2,
    },
    { name: "桁が離れている", seeded: 900, day: dayAfterEpoch(60), floor: -2 },
  ])(
    "$name とき、ドメインの logScoreAfterReactionRemoved と一致する",
    async ({ seeded, day, floor }) => {
      const harness = await setup();
      await harness.seed(seeded);

      await harness.remove(reactionWeightLog(day), floor);

      expect(await harness.score()).toBe(logScoreAfterReactionRemoved(seeded, day, floor));
    },
  );

  /*
   * SQLite の ln は引数が 0 以下だと NULL を返し、NULL は max も飲み込む。素直に書くと
   * 引ききった記事の列が NULL になり、その記事は二度と順位に戻ってこない。
   */
  it("引ききっても NULL を書かず、下限に倒す", async () => {
    const harness = await setup();
    const day = dayAfterEpoch(300);
    const floor = viewWeightLog(dayAfterEpoch(0));
    await harness.seed(floor);

    await harness.remove(reactionWeightLog(day), floor);

    const score = await harness.score();
    expect(score).toBe(floor);
    expect(Number.isFinite(score)).toBe(true);
  });

  /* 差が大きすぎて exp が Infinity になる道も、同じく下限へ倒れる。 */
  it("重みが桁違いに大きくても下限に倒す", async () => {
    const harness = await setup();
    await harness.seed(-500);

    await harness.remove(500, -12.5);

    expect(await harness.score()).toBe(-12.5);
  });
});

describe("押し消しの往復", () => {
  /* 押して消したら元に戻ること。崩れると、押し消しを繰り返すだけで順位を動かせる。 */
  it("押して消すと元のスコアに戻る", async () => {
    const harness = await setup();
    const day = dayAfterEpoch(120);
    const before = 8.5;
    await harness.seed(before);

    await harness.add(reactionWeightLog(day));
    await harness.remove(reactionWeightLog(day), 0);

    expect(await harness.score()).toBeCloseTo(before, 10);
  });

  /* 往復の丸め誤差が積もっても、順位に出る大きさにならないこと。 */
  it("押し消しを 1000 回繰り返しても元の値から動かない", async () => {
    const harness = await setup();
    const day = dayAfterEpoch(200);
    const weight = reactionWeightLog(day);
    const before = 8.5;
    await harness.seed(before);

    for (let i = 0; i < 1000; i++) {
      await harness.add(weight);
      await harness.remove(weight, 0);
    }

    expect(await harness.score()).toBeCloseTo(before, 9);
  });

  /*
   * まだ一度も読まれていない古い記事。出発点とリアクションの重みが桁違いに離れていると、
   * 足した時点で出発点が丸めで消える。消えた値は引き戻せないので、下限が無いと
   * 引ききったまま戻らなくなる。
   */
  it("読まれていない古い記事でも、取り消せば出発点に戻る", async () => {
    const harness = await setup();
    const publishedOn = dayAfterEpoch(6114); // 投稿は遠い過去
    const today = dayAfterEpoch(9720);
    const floor = viewWeightLog(publishedOn);
    await harness.seed(floor);

    await harness.add(reactionWeightLog(today));
    // 桁が離れすぎて、足した結果には出発点の情報が残っていない。
    expect(await harness.score()).toBe(reactionWeightLog(today));

    await harness.remove(reactionWeightLog(today), floor);

    expect(await harness.score()).toBe(floor);
  });
});
