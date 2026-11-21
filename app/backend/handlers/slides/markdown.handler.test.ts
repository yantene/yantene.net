import { afterEach, describe, expect, it, vi } from "vitest";
import { createSlideMarkdownRouter } from "./markdown.handler";
import { seedSlide } from "./test-seed";
import type { ContentStatus } from "~/backend/domain/shared";
import { SlideSlug } from "~/backend/domain/slide";
import * as currentAccountModule from "~/backend/handlers/auth/current-account";
import { createTestD1 } from "~/backend/infra/d1/test-helper";
import { R2SlideContentCache } from "~/backend/infra/r2/r2-slide-content-cache";
import { createTestR2 } from "~/backend/infra/r2/test-helper";
import { createTestApp } from "~/backend/test-app";

const SOURCE = `---
title: 意味だけで書くスライド
publishedOn: 2026-11-14
---

表紙で話すこと。

## 図のページ

![図](./diagram.png)
`;

function env(d1: D1Database, bucket: R2Bucket): Env {
  return { D1: d1, R2: bucket } as unknown as Env;
}

function executionCtx(): ExecutionContext {
  return {
    waitUntil: () => undefined,
    passThroughOnException: () => undefined,
  } as unknown as ExecutionContext;
}

/** メタデータ (D1) と原文 (R2) を揃える。 */
async function seed(d1: D1Database, bucket: R2Bucket): Promise<void> {
  await seedSlide(d1);
  await new R2SlideContentCache(bucket).putSource(SlideSlug.create("semantic-slides"), SOURCE);
}

describe("createSlideMarkdownRouter GET /:slug.md", () => {
  /* フロントマターも、画像の相対パスも書き換えない。書かれたそのまま。 */
  it("serves the source markdown verbatim, frontmatter included", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seed(d1, bucket);

    const res = await createSlideMarkdownRouter().request(
      "/semantic-slides.md",
      {},
      env(d1, bucket),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toBe('inline; filename="semantic-slides.md"');
    expect(res.headers.get("Cache-Control")).toContain("public");
    expect(await res.text()).toBe(SOURCE);
  });

  it("marks the response private while BASIC auth is on (staging)", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seed(d1, bucket);

    const res = await createSlideMarkdownRouter().request(
      "/semantic-slides.md",
      {},
      { ...env(d1, bucket), BASIC_AUTH_USER: "u", BASIC_AUTH_PASS: "p" },
    );

    expect(res.headers.get("Cache-Control")).toContain("private");
  });

  it("returns 404 Problem Details for an unknown slide", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();

    const res = await createSlideMarkdownRouter().request("/missing.md", {}, env(d1, bucket));

    expect(res.status).toBe(404);
    expect(res.headers.get("Content-Type")).toContain("application/problem+json");
  });

  /** スラグとして読めない綴りは 404。読めないことを 500 に化けさせない。 */
  it("returns 404 for an unreadable slug", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();

    const res = await createSlideMarkdownRouter().request("/Bad--Name.md", {}, env(d1, bucket));

    expect(res.status).toBe(404);
  });

  /*
   * 同期が R2 への書き込みまで進んで upsert の手前で落ちると、D1 に行の無い原文が
   * R2 に残る。それを配らない (#316)。
   */
  it("returns 404 when R2 has the source but D1 has no slide", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await new R2SlideContentCache(bucket).putSource(SlideSlug.create("semantic-slides"), SOURCE);

    const res = await createSlideMarkdownRouter().request(
      "/semantic-slides.md",
      {},
      env(d1, bucket),
    );

    expect(res.status).toBe(404);
  });

  /** D1 に在るのに原文が無い = キャッシュ不整合。404 で隠さない (fail-loud)。 */
  it("fails loudly when the source is missing from R2", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seedSlide(d1);

    const res = await createTestApp().request(
      "/slides/semantic-slides.md",
      {},
      env(d1, bucket),
      executionCtx(),
    );

    expect(res.status).toBe(500);
  });
});

describe("slide markdown (full app)", () => {
  /** Hono 側が応答していること (React Router へ委譲されていない)。 */
  it("is reachable through the composed app", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seed(d1, bucket);

    const res = await createTestApp().request(
      "/slides/semantic-slides.md",
      {},
      env(d1, bucket),
      executionCtx(),
    );

    expect(res.status).toBe(200);
    expect(await res.text()).toBe(SOURCE);
  });

  /*
   * `.md` で終わらない要求はページ描画へ素通しする (ダミー委譲の "Not Found")。
   * `Accept` の交渉はしないので、Markdown を名指しされても原文には化けない。
   */
  it.each([
    ["no Accept", undefined],
    ["Accept: text/markdown", "text/markdown"],
  ])("leaves /slides/<slug> to the page router (%s)", async (_label, accept) => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seed(d1, bucket);

    const res = await createTestApp().request(
      "/slides/semantic-slides",
      accept === undefined ? {} : { headers: { Accept: accept } },
      env(d1, bucket),
      executionCtx(),
    );

    expect(await res.text()).toBe("Not Found");
    expect(res.headers.get("Vary") ?? "").not.toContain("Accept");
  });

  it("leaves the list page to the page router", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();

    const res = await createTestApp().request("/slides", {}, env(d1, bucket), executionCtx());

    expect(await res.text()).toBe("Not Found");
  });

  /*
   * ルートを正規表現で絞ると、Hono の SmartRouter が RegExpRouter を諦めて TrieRouter に
   * 落ち、アプリ全体のリクエストが遅いマッチャーを通ることになる。記事の側
   * (articles/markdown.handler.test.ts) にも同じ番人があるが、回帰を起こしうるのは
   * このルータでもあるのでここにも置く。
   */
  it("keeps the whole app on the faster router", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    const app = createTestApp();
    await app.request("/slides/semantic-slides.md", {}, env(d1, bucket), executionCtx());

    expect(app.router.name).toBe("SmartRouter + RegExpRouter");
  });
});

/*
 * status ごとの原文の配信 (ADR 0040)。原文はページと同じものの別表現なので、
 * ページと同じ判定を通す。記事の原文と同じ表になること。
 */
describe("status ごとの原文の配信 (ADR 0040)", () => {
  async function seedWith(d1: D1Database, bucket: R2Bucket, status: ContentStatus): Promise<void> {
    await seedSlide(d1, { status });
    await new R2SlideContentCache(bucket).putSource(SlideSlug.create("semantic-slides"), SOURCE);
  }

  async function fetchSource(status: ContentStatus): Promise<Response> {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seedWith(d1, bucket, status);
    return createSlideMarkdownRouter().request("/semantic-slides.md", {}, env(d1, bucket));
  }

  /** ログインしている管理者として振る舞わせる。 */
  function asAdmin(): void {
    vi.spyOn(currentAccountModule, "currentAccount").mockResolvedValue({
      email: { toString: () => "admin@example.test" } as never,
      admin: true,
    });
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(["withdrawn", "draft", "idea"] as const)("%s は読み手に 404 を返す", async (status) => {
    expect((await fetchSource(status)).status).toBe(404);
  });

  it("unlisted は読み手も読めるが noindex を伝える", async () => {
    const response = await fetchSource("unlisted");

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
  });

  it("published に noindex は付けない", async () => {
    expect((await fetchSource("published")).headers.get("X-Robots-Tag")).toBeNull();
  });

  it.each(["withdrawn", "draft", "idea"] as const)(
    "管理者は %s を読めて、応答は共有キャッシュに載らない",
    async (status) => {
      asAdmin();

      const response = await fetchSource(status);

      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      expect(response.headers.get("Vary")).toContain("Cookie");
      expect(await response.text()).toBe(SOURCE);
    },
  );

  /* 読み手も辿り着けるものは中身が同じなので、管理者が見ていても遠ざけない。 */
  it.each(["published", "unlisted"] as const)(
    "管理者が %s を読んでも共有キャッシュから遠ざけない",
    async (status) => {
      asAdmin();

      const response = await fetchSource(status);

      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).not.toBe("private, no-store");
    },
  );

  it("ログインしていても管理者でなければ draft は 404", async () => {
    vi.spyOn(currentAccountModule, "currentAccount").mockResolvedValue({
      email: { toString: () => "reader@example.test" } as never,
      admin: false,
    });

    expect((await fetchSource("draft")).status).toBe(404);
  });
});
