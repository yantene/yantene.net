import { afterEach, describe, expect, it, vi } from "vitest";
import { createOgRouter } from "./og.handler";
import type { ContentStatus } from "~/backend/domain/shared";
import { OG_TEMPLATE_VERSION } from "./og-card";
import * as currentAccountModule from "~/backend/handlers/auth/current-account";
import { seedSlide } from "~/backend/handlers/slides/test-seed";
import { createTestR2 } from "~/backend/infra/r2/test-helper";
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
    detail: "article not found",
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
describe("createOgRouter GET /articles/:slug が見つからないとき", () => {
  /*
   * D1 を渡さない。読めないスラグは表を引く手前で返るので、これで通ることが
   * 「引く前に断っている」ことの裏取りにもなる。
   */
  it("スラグとして読めない値を、表を引かずに Problem Details で断る", async () => {
    const response = await createOgRouter().request(
      `/articles/${encodeURIComponent("not a slug!")}`,
      {},
      {},
    );

    await expect(refusalOf(response)).resolves.toEqual(problemDetails404);
  });

  it("記事が無いときも Problem Details で断る", async () => {
    // 表は作ってあるが 1 件も入っていない。
    const response = await createOgRouter().request(
      "/articles/missing",
      {},
      envWith(createTestD1()),
    );

    await expect(refusalOf(response)).resolves.toEqual(problemDetails404);
  });

  /*
   * 404 に倒す try で囲ってあるのはスラグの解釈だけで、表を引くところは外に在る。
   * 引くところまで囲うと、D1 の不調が「カードの無い記事」の顔をして静かに通る。
   *
   * いまの ArticleSlug.create は InvalidArticleSlugError しか投げないので、握りの狭さ自体は
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

    const response = await createOgRouter().request("/articles/missing", {}, broken);

    // 404 にならないことが眼目。本番では index.ts の onError がこれを拾う。
    expect(response.status).not.toBe(404);
    expect(response.status).toBeGreaterThanOrEqual(500);
  });
});

/* スライドのカードも、断り方は記事と同じ形に揃える。 */
describe("createOgRouter GET /slides/:slug が見つからないとき", () => {
  const slideNotFound = {
    ...problemDetails404,
    body: { ...problemDetails404.body, detail: "slide not found" },
  };

  it("スラグとして読めない値を、表を引かずに Problem Details で断る", async () => {
    const response = await createOgRouter().request(
      `/slides/${encodeURIComponent("not a slug!")}`,
      {},
      {},
    );

    await expect(refusalOf(response)).resolves.toEqual(slideNotFound);
  });

  it("スライドが無いときも Problem Details で断る", async () => {
    const response = await createOgRouter().request("/slides/missing", {}, envWith(createTestD1()));

    await expect(refusalOf(response)).resolves.toEqual(slideNotFound);
  });
});

/*
 * スライドのカードと status (ADR 0040)。記事のカードと同じ扱い — ログインしていても
 * 読み手向けで引き、限定公開の絵には noindex を付ける。
 *
 * 絵を描くところ (WASM) までは行かせない。蓄えに置いておけば、引いたうえで蓄えを
 * 返す経路を通る。
 */
describe("createOgRouter GET /slides/:slug と status", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function fetchCard(status: ContentStatus): Promise<Response> {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seedSlide(d1, { status, sourceHash: "h1" });
    await bucket.put(
      `og/slides/semantic-slides-h1-${OG_TEMPLATE_VERSION}.png`,
      new Uint8Array([1, 2, 3]),
    );
    return createOgRouter().request(
      "/slides/semantic-slides",
      {},
      {
        D1: d1,
        R2: bucket,
      },
    );
  }

  it("published のカードを返し、noindex は付けない", async () => {
    const response = await fetchCard("published");

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Robots-Tag")).toBeNull();
  });

  /* 絵には題が焼き込んである。画像検索に出ると題と存在が漏れる。 */
  it("unlisted のカードは返すが noindex を付ける", async () => {
    const response = await fetchCard("unlisted");

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
  });

  it.each(["withdrawn", "draft", "idea"] as const)("%s のカードは 404", async (status) => {
    expect((await fetchCard(status)).status).toBe(404);
  });

  it("管理者がログインしていても draft のカードは 404", async () => {
    vi.spyOn(currentAccountModule, "currentAccount").mockResolvedValue({
      email: { toString: () => "admin@example.test" } as never,
      admin: true,
    });

    expect((await fetchCard("draft")).status).toBe(404);
  });
});
