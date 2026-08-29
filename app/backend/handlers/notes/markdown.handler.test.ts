import { Temporal } from "@js-temporal/polyfill";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { createNoteMarkdownRouter } from "./markdown.handler";
import { Note, NoteSlug, NoteTitle } from "~/backend/domain/note";
import { D1NoteCommandRepository } from "~/backend/infra/d1/repositories";
import { createTestD1 } from "~/backend/infra/d1/test-helper";
import { R2NoteContentCache } from "~/backend/infra/r2/r2-note-content-cache";
import { createTestR2 } from "~/backend/infra/r2/test-helper";
import { createTestApp } from "~/backend/test-app";

const helloMarkdown = `---
title: Hello
imageUrl: ./cover.png
publishedOn: 2026-01-15
---

Body with an inline image ![alt](./inline.png).
`;

function env(d1: D1Database, bucket: R2Bucket): Env {
  return { D1: d1, R2: bucket } as unknown as Env;
}

/** D1 のメタデータだけを入れる (R2 の原文は入れない)。 */
async function seedMeta(d1: D1Database): Promise<void> {
  await new D1NoteCommandRepository(d1).upsert(
    Note.create({
      slug: NoteSlug.create("hello"),
      title: NoteTitle.create("Hello"),
      summary: "A summary.",
      publishedOn: Temporal.PlainDate.from("2026-01-15"),
      lastModifiedOn: Temporal.PlainDate.from("2026-01-16"),
      sourceHash: "h1",
    }),
  );
}

/** メタデータ (D1) と原文 (R2) を揃える。 */
async function seed(d1: D1Database, bucket: R2Bucket): Promise<void> {
  await seedMeta(d1);
  await new R2NoteContentCache(bucket).putSource(NoteSlug.create("hello"), helloMarkdown);
}

describe("createNoteMarkdownRouter GET /:slug.md", () => {
  it("serves the source markdown verbatim, frontmatter included", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seed(d1, bucket);

    const res = await createNoteMarkdownRouter().request("/hello.md", {}, env(d1, bucket));

    expect(res.status).toBe(200);
    // 原文そのまま: フロントマターも画像の相対パスも書き換えない。
    expect(await res.text()).toBe(helloMarkdown);
  });

  it("returns markdown content type and an inline disposition", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seed(d1, bucket);

    const res = await createNoteMarkdownRouter().request("/hello.md", {}, env(d1, bucket));

    expect(res.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toBe('inline; filename="hello.md"');
  });

  it("uses public cache-control when BASIC auth is off", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seed(d1, bucket);

    const res = await createNoteMarkdownRouter().request("/hello.md", {}, env(d1, bucket));

    expect(res.headers.get("Cache-Control")).toContain("public");
  });

  it("uses private cache-control when BASIC auth is enabled (staging)", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seed(d1, bucket);

    const res = await createNoteMarkdownRouter().request(
      "/hello.md",
      {},
      {
        ...env(d1, bucket),
        BASIC_AUTH_USER: "u",
        BASIC_AUTH_PASS: "p",
      },
    );

    const cacheControl = res.headers.get("Cache-Control");
    expect(cacheControl).toContain("private");
    expect(cacheControl).not.toContain("public");
  });

  it("returns 404 Problem Details for an unknown slug", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();

    const res = await createNoteMarkdownRouter().request("/missing.md", {}, env(d1, bucket));

    expect(res.status).toBe(404);
    expect(res.headers.get("Content-Type")).toContain("application/problem");
  });

  it("returns 404 for a slug that is not a valid NoteSlug", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();

    const res = await createNoteMarkdownRouter().request("/Invalid_Slug.md", {}, env(d1, bucket));

    expect(res.status).toBe(404);
  });

  // 単一ルート化 (`/:file`) で挙動が変わる唯一の入力。`.md` を落とすと空文字列に
  // なるので、slug として不正 = 404。
  it("returns 404 Problem Details for a bare .md", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();

    const res = await createNoteMarkdownRouter().request("/.md", {}, env(d1, bucket));

    expect(res.status).toBe(404);
    expect(res.headers.get("Content-Type")).toContain("application/problem");
  });

  // 拡張子はネゴシエーションに優先する。`.md` の URL は表現を 1 つしか持たない。
  it("ignores Accept and adds no Vary", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seed(d1, bucket);

    const res = await createNoteMarkdownRouter().request(
      "/hello.md",
      { headers: { Accept: "text/html" } },
      env(d1, bucket),
    );

    expect(res.status).toBe(200);
    expect(await res.text()).toBe(helloMarkdown);
    expect(res.headers.get("Vary")).toBeNull();
    expect(res.headers.get("Cache-Control")).toContain("public");
  });
});

/** Chrome が実際に送る Accept。ここに原文を返してしまうのが最悪の回帰。 */
const CHROME_ACCEPT =
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7";

/** Firefox / Safari が送る Accept。 */
const FIREFOX_ACCEPT = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";

const markdownAccept = { Accept: "text/markdown" };

/** BASIC 認証の有無で Cache-Control が変わらないことを見るための env の差分。 */
const basicAuthEnvs: readonly (readonly [string, Partial<Env>])[] = [
  ["BASIC auth off", {}],
  ["BASIC auth on (staging)", { BASIC_AUTH_USER: "u", BASIC_AUTH_PASS: "p" }],
];

describe("createNoteMarkdownRouter GET /:slug with Accept: text/markdown", () => {
  it("serves the source markdown verbatim with the same headers as .md", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seed(d1, bucket);

    const res = await createNoteMarkdownRouter().request(
      "/hello",
      { headers: markdownAccept },
      env(d1, bucket),
    );

    expect(res.status).toBe(200);
    expect(await res.text()).toBe(helloMarkdown);
    expect(res.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toBe('inline; filename="hello.md"');
  });

  it("tells caches and clients that the URL has two representations", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seed(d1, bucket);

    const res = await createNoteMarkdownRouter().request(
      "/hello",
      { headers: markdownAccept },
      env(d1, bucket),
    );

    expect(res.headers.get("Vary")).toBe("Accept");
    // RFC 9110 §8.7: いま返した表現そのものを指す URL。
    expect(res.headers.get("Content-Location")).toBe("/notes/hello.md");
  });

  /*
   * Cloudflare のエッジは Accept-Encoding 以外の Vary をキャッシュキーに含めない。
   * 共有キャッシュに載せた時点で表現の取り違えが起きるので、`.md` と違って環境
   * (BASIC 認証の有無) に関わらず private で固定する。
   */
  it.each(basicAuthEnvs)("never allows shared caching (%s)", async (_label, authEnv) => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seed(d1, bucket);

    const res = await createNoteMarkdownRouter().request(
      "/hello",
      { headers: markdownAccept },
      { ...env(d1, bucket), ...authEnv },
    );

    expect(res.headers.get("Cache-Control")).toBe("private, max-age=3600");
  });

  it.each([
    ["an unknown slug", "/missing"],
    ["a slug that is not a valid NoteSlug", "/Invalid_Slug"],
  ])("returns 404 Problem Details for %s", async (_label, path) => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();

    const res = await createNoteMarkdownRouter().request(
      path,
      { headers: markdownAccept },
      env(d1, bucket),
    );

    expect(res.status).toBe(404);
    expect(res.headers.get("Content-Type")).toContain("application/problem");
    expect(res.headers.get("Vary")).toBe("Accept");
  });

  /*
   * ステータスでは判定しない。単体のルータには後続が無く、next() が Hono 既定の 404 に
   * 落ちるため「ページへ素通しした」と「見つからなかった」を区別できない。
   */
  it.each([
    ["Chrome", CHROME_ACCEPT],
    ["Firefox / Safari", FIREFOX_ACCEPT],
  ])("passes a browser request (%s) through to the page", async (_label, accept) => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seed(d1, bucket);

    const res = await createNoteMarkdownRouter().request(
      "/hello",
      { headers: { Accept: accept } },
      env(d1, bucket),
    );

    expect(res.headers.get("Content-Type")).not.toContain("text/markdown");
    expect(res.headers.get("Vary")).toContain("Accept");
  });
});

/**
 * ルータの後ろにページ側を模したハンドラを置いたアプリ。
 *
 * 素通しした応答に足すヘッダーは、下流が返した status で変わる。単体のルータでも
 * `createTestApp()` でもページ側は 404 にしかならないので、描けたときの振る舞いは
 * ここで確かめる。
 */
function appWithPage(status: number): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();
  app.route("/notes", createNoteMarkdownRouter());
  app.all("*", () => new Response("page", { status }));
  return app;
}

describe("markdown alternate advertised on the page response", () => {
  it("advertises the alternate when the page rendered", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seed(d1, bucket);

    const res = await appWithPage(200).request(
      "/notes/hello",
      { headers: { Accept: CHROME_ACCEPT } },
      env(d1, bucket),
    );

    expect(res.headers.get("Vary")).toContain("Accept");
    expect(res.headers.get("Link")).toBe(
      '</notes/hello.md>; rel="alternate"; type="text/markdown"',
    );
  });

  /*
   * 見つからなかったページ (loader が status 404 を返す) に付けると、rel=alternate を
   * 辿る相手に必ず 404 になる URL を教えることになる。Vary は在否に関わらず出す。
   */
  it("keeps the alternate off a page that was not found", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seed(d1, bucket);

    const res = await appWithPage(404).request(
      "/notes/hello",
      { headers: { Accept: CHROME_ACCEPT } },
      env(d1, bucket),
    );

    expect(res.headers.get("Vary")).toContain("Accept");
    expect(res.headers.get("Link")).toBeNull();
  });
});

/** ページ委譲 (`app.all("*")`) は executionCtx を触るのでダミーを渡す。 */
function executionCtx(): ExecutionContext {
  return {
    waitUntil: () => {},
    passThroughOnException: () => {},
  } as unknown as ExecutionContext;
}

describe("note markdown routing (full app)", () => {
  it("serves /notes/<slug>.md from Hono without a session", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seed(d1, bucket);

    const res = await createTestApp().request(
      "/notes/hello.md",
      {},
      env(d1, bucket),
      executionCtx(),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
  });

  it("leaves /notes/<slug> (no .md) to the page router", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seed(d1, bucket);

    const res = await createTestApp().request("/notes/hello", {}, env(d1, bucket), executionCtx());

    // test-app のページ委譲はダミー (404 "Not Found") なので、本文で「Hono が
    // 応答せずページ側に落ちた」ことを観測する。
    expect(await res.text()).toBe("Not Found");
  });

  it("leaves /notes (index) to the page router", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();

    const res = await createTestApp().request("/notes", {}, env(d1, bucket), executionCtx());

    expect(await res.text()).toBe("Not Found");
  });

  it("fails loud (500, not silent 404) when an indexed note has no cached source", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seedMeta(d1);

    const res = await createTestApp().request(
      "/notes/hello.md",
      {},
      env(d1, bucket),
      executionCtx(),
    );

    // D1 に在るのに R2 に原文が無い = キャッシュ不整合。404 で隠さず 500 で表面化させる。
    expect(res.status).toBe(500);
  });

  /*
   * ルートを `/:file{[^/]+[.]md}` と `/:slug` に分けると、Hono の SmartRouter が
   * RegExpRouter を諦めて TrieRouter に落ち、アプリ全体のリクエストが遅いマッチャーを
   * 通ることになる。legacy-redirects.handler.test.ts にも同じ番人があるが、回帰を
   * 起こすのはこのルータなのでここにも置く。
   */
  it("keeps the whole app on the faster router", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    const app = createTestApp();
    await app.request("/notes/hello.md", {}, env(d1, bucket));

    expect(app.router.name).toBe("SmartRouter + RegExpRouter");
  });
});

describe("note markdown negotiation (full app)", () => {
  /*
   * ブラウザに原文を配ってしまうのがこの機能の最悪の回帰。Chrome の実文字列を含めて、
   * 記事ページに落ちること (ダミー委譲の "Not Found") を固定する。
   */
  it.each([
    ["no Accept", undefined],
    ["Chrome", CHROME_ACCEPT],
    ["Firefox / Safari", FIREFOX_ACCEPT],
    ["*/* (curl)", "*/*"],
  ])("leaves /notes/<slug> to the page router (%s)", async (_label, accept) => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seed(d1, bucket);

    const res = await createTestApp().request(
      "/notes/hello",
      accept === undefined ? {} : { headers: { Accept: accept } },
      env(d1, bucket),
      executionCtx(),
    );

    expect(await res.text()).toBe("Not Found");
  });

  it("tells caches that the page URL varies by Accept", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seed(d1, bucket);

    const res = await createTestApp().request(
      "/notes/hello",
      { headers: { Accept: CHROME_ACCEPT } },
      env(d1, bucket),
      executionCtx(),
    );

    expect(res.headers.get("Vary")).toContain("Accept");
  });

  it("serves the source markdown when Accept names it", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seed(d1, bucket);

    const res = await createTestApp().request(
      "/notes/hello",
      { headers: markdownAccept },
      env(d1, bucket),
      executionCtx(),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
    expect(await res.text()).toBe(helloMarkdown);
    // ページ描画を経ないので閲覧数は数えず、読み手のセッションも発行しない。
    expect(res.headers.get("Set-Cookie")).toBeNull();
  });

  it("answers a HEAD request with the same headers and no body", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seed(d1, bucket);

    const res = await createTestApp().request(
      "/notes/hello",
      { method: "HEAD", headers: markdownAccept },
      env(d1, bucket),
      executionCtx(),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
    expect(res.headers.get("Content-Location")).toBe("/notes/hello.md");
    expect(await res.text()).toBe("");
  });

  /*
   * 判定するのは GET / HEAD だけ。リアクションの action は同じ URL への POST なので、
   * ここを巻き込むとフォーム送信が原文で返ってしまう。
   */
  it("does not negotiate a POST", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seed(d1, bucket);

    const res = await createTestApp().request(
      "/notes/hello",
      { method: "POST", headers: markdownAccept },
      env(d1, bucket),
      executionCtx(),
    );

    expect(await res.text()).toBe("Not Found");
  });

  it.each([
    ["the note index", "/notes"],
    ["a nested path", "/notes/a/b"],
  ])("leaves %s to the page router even for markdown", async (_label, path) => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seed(d1, bucket);

    const res = await createTestApp().request(
      path,
      { headers: markdownAccept },
      env(d1, bucket),
      executionCtx(),
    );

    expect(await res.text()).toBe("Not Found");
  });

  /*
   * クライアント遷移が使う React Router のデータ経路。単一ルート化で `/:file` を
   * 通るようになったので、素通りし続けることを固定する。
   */
  it("leaves a client navigation data request to the page router", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seed(d1, bucket);

    const res = await createTestApp().request(
      "/notes/hello.data",
      {},
      env(d1, bucket),
      executionCtx(),
    );

    expect(await res.text()).toBe("Not Found");
  });

  it("fails loud (500) when an indexed note has no cached source", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seedMeta(d1);

    const res = await createTestApp().request(
      "/notes/hello",
      { headers: markdownAccept },
      env(d1, bucket),
      executionCtx(),
    );

    expect(res.status).toBe(500);
  });
});
