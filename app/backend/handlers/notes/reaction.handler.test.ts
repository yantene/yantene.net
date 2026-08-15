/*
 * @vitest-environment node
 *
 * 既定の happy-dom は fetch 仕様に従って `cookie` を forbidden header として剥がすため、
 * リクエストにセッションを載せられない。ここはセッションの往復そのものを確かめるので、
 * ヘッダーをそのまま通す node で走らせる。
 */
import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import type { ReactionsPayload } from "./reaction.handler";
import { Note, NoteSlug, NoteTitle } from "~/backend/domain/note";
import { viewWeightLog } from "~/backend/domain/note-view";
import { D1NoteCommandRepository } from "~/backend/infra/d1/repositories";
import { createTestD1, readViewLogScore } from "~/backend/infra/d1/test-helper";
import { createTestKv } from "~/backend/infra/kv/test-helper";
import { createTestApp } from "~/backend/test-app";

const PUBLISHED_ON = "2026-01-15";

interface Harness {
  readonly env: Env;
  readonly noteId: string;
  /** 応答が返した cookie。次のリクエストへ持ち回る。 */
  cookie: string;
}

async function setup(): Promise<Harness> {
  const d1 = createTestD1();
  const { kv } = createTestKv();
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
    env: { D1: d1, SESSIONS: kv, APP_ENV: "test" } as unknown as Env,
    noteId: note.id,
    cookie: "",
  };
}

/** リアクションを押す。応答の Set-Cookie を次回に持ち回る。 */
async function put(
  harness: Harness,
  emoji: string,
  slug = "alpha",
): Promise<{ status: number; payload: ReactionsPayload }> {
  const res = await createTestApp().request(
    `/api/v1/notes/${slug}/reaction`,
    {
      method: "PUT",
      body: JSON.stringify({ emoji }),
      headers: harness.cookie === "" ? {} : { cookie: harness.cookie },
    },
    harness.env,
  );

  const issued = res.headers.get("set-cookie");
  if (issued !== null) harness.cookie = issued.split(";", 1)[0] ?? "";

  return {
    status: res.status,
    payload: res.ok ? await res.json() : { reactions: [], mine: null },
  };
}

async function remove(harness: Harness): Promise<ReactionsPayload> {
  const res = await createTestApp().request(
    "/api/v1/notes/alpha/reaction",
    {
      method: "DELETE",
      headers: harness.cookie === "" ? {} : { cookie: harness.cookie },
    },
    harness.env,
  );
  return await res.json();
}

function logScore(harness: Harness): Promise<number | undefined> {
  return readViewLogScore(harness.env.D1, harness.noteId);
}

describe("リアクション API", () => {
  it("押すと数が増え、押した本人には mine が返る", async () => {
    const harness = await setup();

    const { payload } = await put(harness, "❤️");

    expect(payload).toEqual({
      reactions: [{ emoji: "❤️", count: 1 }],
      mine: "❤️",
    });
  });

  it("cookie を持っていない相手にはセッションを発行する", async () => {
    const harness = await setup();

    await put(harness, "❤️");

    expect(harness.cookie).toMatch(/^session=/);
  });

  /* 1 ノートにつき 1 つ。別のものを押したら乗り換える。 */
  it("別の絵文字を押すと差し替わる", async () => {
    const harness = await setup();

    await put(harness, "❤️");
    const { payload } = await put(harness, "🎉");

    expect(payload).toEqual({
      reactions: [{ emoji: "🎉", count: 1 }],
      mine: "🎉",
    });
  });

  it("同じ人が何度押しても数は増えない", async () => {
    const harness = await setup();

    await put(harness, "❤️");
    const { payload } = await put(harness, "❤️");

    expect(payload.reactions).toEqual([{ emoji: "❤️", count: 1 }]);
  });

  it("取り消すと数が戻り、mine が空になる", async () => {
    const harness = await setup();

    await put(harness, "❤️");
    const payload = await remove(harness);

    expect(payload).toEqual({ reactions: [], mine: null });
  });

  /*
   * 押して消すとスコアが元に戻ること。ここが崩れると、押し消しを繰り返すだけで
   * 順位を動かせてしまう。
   */
  it("押して消すとスコアが元に戻る", async () => {
    const harness = await setup();
    const before = await logScore(harness);

    await put(harness, "❤️");
    const reacted = await logScore(harness);
    await remove(harness);
    const after = await logScore(harness);

    expect(reacted).toBeGreaterThan(before ?? 0);
    expect(after).toBeCloseTo(before ?? 0, 10);
  });

  /*
   * 差し替えではスコアを動かさない。ここで今日の重みに付け替えると、絵文字を押し直す
   * だけでスコアを積める抜け道になる。
   */
  it("差し替えではスコアが動かない", async () => {
    const harness = await setup();

    await put(harness, "❤️");
    const afterFirst = await logScore(harness);
    await put(harness, "🎉");
    const afterSwap = await logScore(harness);

    expect(afterSwap).toBe(afterFirst);
  });

  /*
   * まだ一度も読まれていない古い記事で踏んだ穴 (この記事がまさにそれ)。出発点と
   * リアクションの重みが桁違いに離れていると、足した時点で出発点が丸めで消える。
   * 下限を渡していないと、取り消しで引ききったまま戻らなくなる。
   */
  it("読まれていない古い記事でも、取り消せば出発点に戻る", async () => {
    const harness = await setup();
    const floor = viewWeightLog(PUBLISHED_ON);

    await put(harness, "❤️");
    await remove(harness);

    const score = await logScore(harness);

    /*
     * 見たいのは「引ききったまま戻らなくなっていないこと」。
     *
     * 完全一致では見られない。足し引きは log-sum-exp を通るので、必ず丸めの誤差が残る。
     * しかもリアクションの重みは**実行した日**で決まるため、出発点 (投稿日) から離れる
     * ほど誤差の出方が変わる。実際、日付をまたいだだけでこのテストは落ちた。
     *
     * 下回っていないことと、実用上戻っていることの 2 つで見る。順位付けにしか使わない
     * 値なので、小数第 6 位より下の差に意味はない。
     */
    expect(score).toBeGreaterThanOrEqual(floor);
    expect(score).toBeCloseTo(floor, 6);
  });

  it("出発点は投稿日の重み", async () => {
    const harness = await setup();

    expect(await logScore(harness)).toBe(viewWeightLog(PUBLISHED_ON));
  });

  /* 一覧に無い絵文字は弾く。既定に倒して黙って別のものを記録したりしない。 */
  it("使えない絵文字は 400 で断る", async () => {
    const harness = await setup();

    const { status } = await put(harness, "not-an-emoji");

    expect(status).toBe(400);
  });

  it("肌の色が付いた絵文字も断る", async () => {
    const harness = await setup();

    const { status } = await put(harness, "👍🏽");

    expect(status).toBe(400);
  });

  it("無い記事へのリアクションは 404", async () => {
    const harness = await setup();

    const { status } = await put(harness, "❤️", "missing");

    expect(status).toBe(404);
  });

  /* 押していない相手の取り消しで数を負にしない。 */
  it("押していない人が取り消しても壊れない", async () => {
    const harness = await setup();

    const payload = await remove(harness);

    expect(payload).toEqual({ reactions: [], mine: null });
  });
});
