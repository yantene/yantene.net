import { Temporal } from "@js-temporal/polyfill";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArticleDetail } from "./article-detail-view";
import type { ArticleStatus } from "~/backend/domain/article";
import { ImageUrl, Article, ArticleSlug, ArticleTitle } from "~/backend/domain/article";
import { D1ArticleCommandRepository } from "~/backend/infra/d1/repositories";
import { createTestD1 } from "~/backend/infra/d1/test-helper";
import { R2ArticleContentCache } from "~/backend/infra/r2/r2-article-content-cache";
import { createTestApp } from "~/backend/test-app";
import * as currentAccountModule from "~/backend/handlers/auth/current-account";
import { loadArticleDetailPage } from "./detail.handler";

/** MDAST の put/get だけを賄う最小 R2 モック。 */
function makeBucket(): R2Bucket {
  const store = new Map<string, string>();
  return {
    put: (key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    },
    get: (key: string) => {
      const found = store.get(key);
      if (found === undefined) return Promise.resolve(null);
      return Promise.resolve({ text: () => Promise.resolve(found) });
    },
  } as unknown as R2Bucket;
}

const sampleMdast = {
  type: "root",
  children: [{ type: "paragraph", children: [{ type: "text", value: "Body." }] }],
};

async function seed(d1: D1Database, bucket: R2Bucket): Promise<void> {
  await new D1ArticleCommandRepository(d1).upsert(
    Article.create({
      slug: ArticleSlug.create("hello"),
      title: ArticleTitle.create("Hello"),
      summary: "A summary.",
      imageUrl: ImageUrl.create("/api/v1/articles/hello/assets/cover.png"),
      publishedOn: Temporal.PlainDate.from("2026-01-15"),
      lastModifiedOn: Temporal.PlainDate.from("2026-01-16"),
      status: "published",
      sourceHash: "h1",
    }),
  );
  await new R2ArticleContentCache(bucket).putMdast(ArticleSlug.create("hello"), sampleMdast);
}

function env(d1: D1Database, bucket: R2Bucket): Env {
  return { D1: d1, R2: bucket } as unknown as Env;
}

async function fetchDetail(
  d1: D1Database,
  bucket: R2Bucket,
  slug: string,
): Promise<{ status: number; body: ArticleDetail | undefined }> {
  const res = await createTestApp().request(`/api/v1/articles/${slug}`, {}, env(d1, bucket));
  const text = await res.text();
  return {
    status: res.status,
    body: res.status === 200 ? (JSON.parse(text) as ArticleDetail) : undefined,
  };
}

describe("createArticleDetailApiRouter GET /:slug", () => {
  it("returns article metadata and cached MDAST", async () => {
    const d1 = createTestD1();
    const bucket = makeBucket();
    await seed(d1, bucket);

    const { status, body } = await fetchDetail(d1, bucket, "hello");
    expect(status).toBe(200);
    expect(body?.article.title).toBe("Hello");
    expect(body?.article.imageUrl).toBe("/api/v1/articles/hello/assets/cover.png");
    expect(body?.mdast).toEqual(sampleMdast);
  });

  it("returns 404 when the article metadata is missing", async () => {
    const d1 = createTestD1();
    const bucket = makeBucket();
    const { status } = await fetchDetail(d1, bucket, "missing");
    expect(status).toBe(404);
  });

  it("fails loud (500, not silent 404) when an indexed article has no cached MDAST", async () => {
    const d1 = createTestD1();
    const bucket = makeBucket();
    await new D1ArticleCommandRepository(d1).upsert(
      Article.create({
        slug: ArticleSlug.create("no-body"),
        title: ArticleTitle.create("No Body"),
        summary: "s",
        publishedOn: Temporal.PlainDate.from("2026-01-15"),
        lastModifiedOn: Temporal.PlainDate.from("2026-01-15"),
        status: "published",
        sourceHash: "h2",
      }),
    );
    // D1 に在るのに R2 に MDAST が無い = キャッシュ不整合。404 で隠さず 500 で表面化させる。
    const { status } = await fetchDetail(d1, bucket, "no-body");
    expect(status).toBe(500);
  });

  it("returns 404 for an invalid slug", async () => {
    const d1 = createTestD1();
    const bucket = makeBucket();
    const { status } = await fetchDetail(d1, bucket, "Invalid_Slug");
    expect(status).toBe(404);
  });
});

/*
 * ページの loader が返す payload (ADR 0040)。
 *
 * `noindex` は meta と X-Robots-Tag の両方の元になる 1 つの真実なので、ここで固定する。
 */
describe("loadArticleDetailPage の status (ADR 0040)", () => {
  async function seedWith(d1: D1Database, bucket: R2Bucket, status: ArticleStatus): Promise<void> {
    await new D1ArticleCommandRepository(d1).upsert(
      Article.create({
        slug: ArticleSlug.create("hello"),
        title: ArticleTitle.create("Hello"),
        summary: "A summary.",
        publishedOn: Temporal.PlainDate.from("2026-01-15"),
        lastModifiedOn: Temporal.PlainDate.from("2026-01-16"),
        status,
        sourceHash: "h1",
      }),
    );
    await new R2ArticleContentCache(bucket).putMdast(ArticleSlug.create("hello"), sampleMdast);
  }

  const request = (): Request => new Request("https://example.test/articles/hello");

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("unlisted は noindex を立てる", async () => {
    const d1 = createTestD1();
    const bucket = makeBucket();
    await seedWith(d1, bucket, "unlisted");

    const page = await loadArticleDetailPage(
      env(d1, bucket),
      request(),
      "hello",
      "https://example.test",
      null,
    );

    if (!page.found) throw new Error("記事が見つかっていない");
    expect(page.noindex).toBe(true);
  });

  it("published は noindex を立てない", async () => {
    const d1 = createTestD1();
    const bucket = makeBucket();
    await seedWith(d1, bucket, "published");

    const page = await loadArticleDetailPage(
      env(d1, bucket),
      request(),
      "hello",
      "https://example.test",
      null,
    );

    if (!page.found) throw new Error("記事が見つかっていない");
    expect(page.noindex).toBe(false);
  });

  it.each(["withdrawn", "draft", "idea"] as const)("%s は読み手には無い", async (status) => {
    const d1 = createTestD1();
    const bucket = makeBucket();
    await seedWith(d1, bucket, status);

    const page = await loadArticleDetailPage(
      env(d1, bucket),
      request(),
      "hello",
      "https://example.test",
      null,
    );

    expect(page.found).toBe(false);
  });

  /*
   * 管理者は下書きを読める。**noindex は立てない** — 見えているのは cookie を持つ
   * 本人だけで、クローラーはそもそも辿り着けない。代わりに admin が立ち、
   * loader が `Cache-Control: private, no-store` を付ける。
   */
  it("管理者は draft を読めて、admin が立つ", async () => {
    const d1 = createTestD1();
    const bucket = makeBucket();
    await seedWith(d1, bucket, "draft");
    vi.spyOn(currentAccountModule, "currentAccount").mockResolvedValue({
      email: { toString: () => "admin@example.test" } as never,
      admin: true,
    });

    const page = await loadArticleDetailPage(
      env(d1, bucket),
      request(),
      "hello",
      "https://example.test",
      null,
    );

    if (!page.found) throw new Error("管理者なら読めるはず");
    expect(page.admin).toBe(true);
    expect(page.noindex).toBe(false);
  });
});
