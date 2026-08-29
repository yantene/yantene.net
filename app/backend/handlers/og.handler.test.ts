import { describe, expect, it } from "vitest";
import { createOgRouter } from "./og.handler";
import { createTestD1 } from "~/backend/infra/d1/test-helper";

/** カードを描くところまでは行かないので、D1 だけあればよい。 */
function envWith(d1: D1Database): Env {
  return { D1: d1 } as unknown as Env;
}

/** 応答を、断り方として見比べられる形に均す。 */
async function refusalOf(
  response: Response,
): Promise<{ status: number; contentType: string; body: unknown }> {
  return {
    status: response.status,
    contentType: response.headers.get("Content-Type") ?? "",
    body: await response.json(),
  };
}

/** RFC 9457 が必須にしている項目。断り方が変わったらここで気づく。 */
const problemDetails404 = {
  status: 404,
  contentType: "application/problem+json",
  body: {
    type: "about:blank",
    title: "Not Found",
    status: 404,
    detail: "note not found",
  },
};

/*
 * 見つからなかったときの形。
 *
 * 返すものが画像であっても、返せなかったときの形はサイト全体で 1 つに揃える
 * (RFC 9457 Problem Details)。ここだけ Hono 既定の素の 404 に戻っていたのが #277。
 * 同じく画像を配る link-cards/assets.handler.ts が Problem Details で断っているので、
 * 「画像だから API ではない」は理由にならない。
 */
describe("createOgRouter GET /notes/:slug が見つからないとき", () => {
  /*
   * D1 を渡さない。読めないスラグは表を引く手前で返るので、これで通ることが
   * 「引く前に断っている」ことの裏取りにもなる。
   */
  it("スラグとして読めない値を、表を引かずに Problem Details で断る", async () => {
    const response = await createOgRouter().request(
      `/notes/${encodeURIComponent("not a slug!")}`,
      {},
      {},
    );

    await expect(refusalOf(response)).resolves.toEqual(problemDetails404);
  });

  it("記事が無いときも Problem Details で断る", async () => {
    // 表は作ってあるが 1 件も入っていない。
    const response = await createOgRouter().request("/notes/missing", {}, envWith(createTestD1()));

    await expect(refusalOf(response)).resolves.toEqual(problemDetails404);
  });

  /*
   * 404 に倒す try で囲ってあるのはスラグの解釈だけで、表を引くところは外に在る。
   * 引くところまで囲うと、D1 の不調が「カードの無い記事」の顔をして静かに通る。
   *
   * いまの NoteSlug.create は InvalidNoteSlugError しか投げないので、握りの狭さ自体は
   * 入力からは確かめようがない。代わりに、握りの外に在るべきものが外に在ることを見る。
   */
  it("表を引けなかった失敗は握らずに投げる", async () => {
    const broken = {
      D1: {
        prepare: () => {
          throw new Error("D1 is down");
        },
      },
    } as unknown as Env;

    const response = await createOgRouter().request("/notes/missing", {}, broken);

    // 404 にならないことが眼目。本番では index.ts の onError がこれを拾う。
    expect(response.status).not.toBe(404);
    expect(response.status).toBeGreaterThanOrEqual(500);
  });
});
