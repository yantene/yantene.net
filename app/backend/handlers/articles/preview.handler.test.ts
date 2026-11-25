import { Temporal } from "@js-temporal/polyfill";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArticlePreview } from "./preview.handler";
import type { ArticleStatus } from "~/backend/domain/article";
import { ImageUrl, Article, ArticleSlug, ArticleTitle } from "~/backend/domain/article";
import * as currentAccountModule from "~/backend/handlers/auth/current-account";
import { D1ArticleCommandRepository } from "~/backend/infra/d1/repositories";
import { createTestD1 } from "~/backend/infra/d1/test-helper";
import { createTestApp } from "~/backend/test-app";

async function seedWith(d1: D1Database, status: ArticleStatus): Promise<void> {
  await new D1ArticleCommandRepository(d1).upsert(
    Article.create({
      slug: ArticleSlug.create("hello"),
      title: ArticleTitle.create("Hello"),
      summary: "A summary.",
      imageUrl: ImageUrl.create("/api/v1/articles/hello/assets/cover.png"),
      publishedOn: Temporal.PlainDate.from("2026-01-15"),
      lastModifiedOn: Temporal.PlainDate.from("2026-01-16"),
      status,
      sourceHash: "h1",
    }),
  );
}

function fetchPreview(d1: D1Database, slug: string, extra: Partial<Env> = {}): Promise<Response> {
  return Promise.resolve(
    createTestApp().request(
      `/api/v1/articles/${slug}/preview`,
      {},
      {
        D1: d1,
        ...extra,
      },
    ),
  );
}

describe("createArticlePreviewApiRouter GET /:slug/preview", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the title, summary, publication date and cover image", async () => {
    const d1 = createTestD1();
    await seedWith(d1, "published");

    const res = await fetchPreview(d1, "hello");

    expect(res.status).toBe(200);
    expect(await res.json<ArticlePreview>()).toEqual({
      slug: "hello",
      title: "Hello",
      summary: "A summary.",
      publishedOn: "2026-01-15",
      imageUrl: "/api/v1/articles/hello/assets/cover.png",
      language: "ja",
    });
  });

  it("can be kept by shared caches", async () => {
    const d1 = createTestD1();
    await seedWith(d1, "published");

    const res = await fetchPreview(d1, "hello");

    expect(res.headers.get("Cache-Control")).toBe("public, max-age=3600");
  });

  /*
   * BASIC 認証のある環境 (staging) で共有キャッシュに載ると、認証を通っていない相手にも
   * 配られる。アセットや原文と同じ振り分けに乗っていることを固定する。
   */
  it("stays out of shared caches where BASIC auth is on", async () => {
    const d1 = createTestD1();
    await seedWith(d1, "published");

    const credentials = { BASIC_AUTH_USER: "user", BASIC_AUTH_PASS: "pass" };
    const res = await createTestApp().request(
      "/api/v1/articles/hello/preview",
      { headers: { Authorization: `Basic ${btoa("user:pass")}` } },
      { D1: d1, ...credentials },
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=3600");
  });

  /*
   * unlisted は URL を知っていれば読める記事で、記事ページも記事の JSON API も読み手に
   * 返している。リンクを張った書き手は URL を本文で明かしているので、題を返しても
   * 新しく漏れるものが無い。
   */
  it("returns an unlisted article, as the article page and the JSON API do", async () => {
    const d1 = createTestD1();
    await seedWith(d1, "unlisted");

    const res = await fetchPreview(d1, "hello");

    expect(res.status).toBe(200);
  });

  it.each(["withdrawn", "draft", "idea"] as const)("hides a %s article as 404", async (status) => {
    const d1 = createTestD1();
    await seedWith(d1, status);

    const res = await fetchPreview(d1, "hello");

    expect(res.status).toBe(404);
    expect(res.headers.get("Content-Type")).toContain("application/problem+json");
    expect(await res.text()).not.toContain("Hello");
  });

  /*
   * **管理者にも下書きは返さない。** この応答は公開のキャッシュに載るので、管理者に
   * 返した下書きの題が、同じ URL を引いた読み手に配られる。そもそも誰が引いているかを
   * 問わないこと (セッションを見に行かないこと) まで固定する。
   */
  it.each(["withdrawn", "draft", "idea"] as const)(
    "hides a %s article from the admin too, without asking who is reading",
    async (status) => {
      const d1 = createTestD1();
      await seedWith(d1, status);
      const currentAccount = vi
        .spyOn(currentAccountModule, "currentAccount")
        .mockResolvedValue({ email: "admin@example.test", admin: true } as never);

      const res = await fetchPreview(d1, "hello");

      expect(res.status).toBe(404);
      expect(currentAccount).not.toHaveBeenCalled();
    },
  );

  it("returns 404 as a problem document when there is no such article", async () => {
    const d1 = createTestD1();

    const res = await fetchPreview(d1, "missing");

    expect(res.status).toBe(404);
    expect(res.headers.get("Content-Type")).toContain("application/problem+json");
  });

  it("returns 404 for a slug that cannot exist", async () => {
    const d1 = createTestD1();

    const res = await fetchPreview(d1, "Invalid_Slug");

    expect(res.status).toBe(404);
  });

  it("returns null when the article has no cover image", async () => {
    const d1 = createTestD1();
    await new D1ArticleCommandRepository(d1).upsert(
      Article.create({
        slug: ArticleSlug.create("plain"),
        title: ArticleTitle.create("Plain"),
        summary: "s",
        publishedOn: Temporal.PlainDate.from("2026-01-15"),
        lastModifiedOn: Temporal.PlainDate.from("2026-01-15"),
        status: "published",
        sourceHash: "h2",
      }),
    );

    const res = await fetchPreview(d1, "plain");

    expect((await res.json<ArticlePreview>()).imageUrl).toBeNull();
  });

  /*
   * `/:slug/preview` を足しても、アプリ全体が速いほうのルータに残っていること
   * (markdown.handler.test.ts の番人と同じ)。
   */
  it("keeps the whole app on the faster router", async () => {
    const d1 = createTestD1();
    const app = createTestApp();
    await app.request("/api/v1/articles/hello/preview", {}, { D1: d1 });

    expect(app.router.name).toBe("SmartRouter + RegExpRouter");
  });
});
