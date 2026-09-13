/*
 * @vitest-environment node
 *
 * 既定の happy-dom は fetch 仕様に従って `cookie` を forbidden header として剥がすため、
 * リクエストにセッションを載せられない。ここは「押した本人の押下を、続けてもう一度
 * 受ける」ところを確かめるので、ヘッダーをそのまま通す node で走らせる
 * (reaction.handler.test.ts と同じ理由)。
 */
import { Temporal } from "@js-temporal/polyfill";
import { RouterContextProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { action, headers } from "./articles.$slug";
import type { Route } from "./+types/articles.$slug";
import { Article, ArticleSlug, ArticleTitle } from "~/backend/domain/article";
import {
  D1ArticleCommandRepository,
  D1ArticleReactionQueryRepository,
} from "~/backend/infra/d1/repositories";
import { createTestD1 } from "~/backend/infra/d1/test-helper";
import { createTestKv } from "~/backend/infra/kv/test-helper";
import { cloudflareContext } from "~/frontend/lib/route-context";

const SLUG = "alpha";
const PUBLISHED_ON = "2026-01-15";

interface Harness {
  readonly env: Env;
  readonly context: RouterContextProvider;
  readonly articleId: string;
  /** 応答が返した cookie。次の押下へ持ち回る。 */
  cookie: string;
}

async function setup(): Promise<Harness> {
  const d1 = createTestD1();
  const { kv } = createTestKv();
  const article = await new D1ArticleCommandRepository(d1).upsert(
    Article.create({
      slug: ArticleSlug.create(SLUG),
      title: ArticleTitle.create("Alpha"),
      summary: "summary",
      imageUrl: undefined,
      publishedOn: Temporal.PlainDate.from(PUBLISHED_ON),
      lastModifiedOn: Temporal.PlainDate.from(PUBLISHED_ON),
      status: "published",
      sourceHash: "hash-0",
    }),
  );

  const env = { D1: d1, SESSIONS: kv, APP_ENV: "test" } as unknown as Env;
  const context = new RouterContextProvider();
  // action は ctx を使わない (waitUntil が要るのは閲覧を数える loader のほう)。
  context.set(cloudflareContext, {
    env,
    ctx: {} as unknown as ExecutionContext,
  });

  return { env, context, articleId: article.id, cookie: "" };
}

/** リアクションの行から押下を 1 つ送る。空文字は取り消し。 */
async function submit(harness: Harness, emoji: string, slug: string = SLUG): Promise<Response> {
  const body = new FormData();
  body.set("emoji", emoji);
  const request = new Request(`https://example.test/articles/${slug}`, {
    method: "POST",
    body,
    headers: harness.cookie === "" ? {} : { cookie: harness.cookie },
  });

  const response = await action({
    request,
    url: new URL(request.url),
    params: { slug },
    pattern: "/articles/:slug",
    context: harness.context,
  } satisfies Route.ActionArgs);

  const issued = response.headers.get("set-cookie");
  if (issued !== null) harness.cookie = issued.split(";", 1)[0] ?? "";

  return response;
}

function listReactions(harness: Harness): Promise<readonly { emoji: string; count: number }[]> {
  return new D1ArticleReactionQueryRepository(harness.env.D1).listByArticleId(harness.articleId);
}

describe("記事ページの action", () => {
  it("使える絵文字なら記録して記事へ送り返す", async () => {
    const harness = await setup();

    const response = await submit(harness, "❤️");

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`/articles/${SLUG}`);
    expect(await listReactions(harness)).toEqual([{ emoji: "❤️", count: 1 }]);
  });

  /*
   * 一覧に無い絵文字で例外を投げていた (#253)。ErrorBoundary に落ちて 500 になり、
   * 同じ入力を 400 で断る API と扱いが割れていた。
   */
  it("一覧に無い絵文字は throw せず、API と同じ 400 で断る", async () => {
    const harness = await setup();

    const response = await submit(harness, "not-an-emoji");

    expect(response.status).toBe(400);
  });

  it("肌の色が付いた絵文字も 400 で断る", async () => {
    const harness = await setup();

    const response = await submit(harness, "👍🏽");

    expect(response.status).toBe(400);
  });

  /*
   * 記事が無いときも同じ形で割れていた (#269)。applyReaction が投げる
   * ArticleNotFoundError は Hono の onError に届かないので、ページ側では 500 になる。
   * 非公開に切り替えた直後、開いたままのタブから押すと踏める。
   */
  it("無い記事へ押しても throw せず、API と同じ 404 で断る", async () => {
    const harness = await setup();

    const response = await submit(harness, "❤️", "does-not-exist");

    expect(response.status).toBe(404);
  });

  it("スラグとして読めない値も 404 で断る", async () => {
    const harness = await setup();

    const response = await submit(harness, "❤️", "not a slug!");

    expect(response.status).toBe(404);
  });

  /*
   * 読めない値を取り消しに倒さない。押した人は「付ける」つもりで押しているので、
   * すでに押しているものが外れるほうが、500 と同じくらい意図から遠い。
   */
  it("読めない絵文字を押しても、いま押しているものは外れない", async () => {
    const harness = await setup();

    await submit(harness, "❤️");
    await submit(harness, "not-an-emoji");

    expect(await listReactions(harness)).toEqual([{ emoji: "❤️", count: 1 }]);
  });

  /* 値が無いのは「読めない」ではなく取り消し。ここまで 400 にしない。 */
  it("空の値は取り消しとして受ける", async () => {
    const harness = await setup();

    await submit(harness, "❤️");
    const response = await submit(harness, "");

    expect(response.status).toBe(303);
    expect(await listReactions(harness)).toEqual([]);
  });
});

/*
 * loader が付けたヘッダーを文書の応答まで運ぶ関数 (ADR 0040)。
 *
 * ⚠️ **この export を消すと `Set-Cookie` 以外が黙って捨てられる。** React Router の
 * `getDocumentHeaders` は、route が `headers` を持たないとき `prependCookies` しか
 * 呼ばない。管理者の下書きが `private, no-store` 無しで配られ、しかも画面は何も
 * 変わらないので気づけない。番人としてここに置く。
 */
describe("記事ページの headers", () => {
  const call = (loader: Headers, parent: Headers = new Headers()): Headers =>
    new Headers(
      headers({
        loaderHeaders: loader,
        parentHeaders: parent,
        actionHeaders: new Headers(),
        errorHeaders: undefined,
      }),
    );

  it("管理者向けのキャッシュ指定を運ぶ", () => {
    const result = call(new Headers({ "Cache-Control": "private, no-store", Vary: "Cookie" }));

    expect(result.get("Cache-Control")).toBe("private, no-store");
    expect(result.get("Vary")).toBe("Cookie");
  });

  it("限定公開の X-Robots-Tag を運ぶ", () => {
    expect(call(new Headers({ "X-Robots-Tag": "noindex" })).get("X-Robots-Tag")).toBe("noindex");
  });

  it("親のヘッダーを消さない", () => {
    const result = call(new Headers(), new Headers({ "X-From-Parent": "kept" }));

    expect(result.get("X-From-Parent")).toBe("kept");
  });

  it("loader が何も付けなければ何も足さない", () => {
    expect(call(new Headers()).get("Cache-Control")).toBeNull();
  });
});
