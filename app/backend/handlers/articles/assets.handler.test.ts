import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import { createArticleAssetsRouter } from "./assets.handler";
import { Article, ArticleSlug, ArticleTitle } from "~/backend/domain/article";
import type { ContentEntry, IContentStore } from "~/backend/domain/content";
import {
  D1ArticleCommandRepository,
  D1ArticleQueryRepository,
  D1ArticleSearchIndex,
} from "~/backend/infra/d1/repositories";
import { createTestD1 } from "~/backend/infra/d1/test-helper";
import { R2ArticleContentCache } from "~/backend/infra/r2/r2-article-content-cache";
import { createTestR2 } from "~/backend/infra/r2/test-helper";
import { createTestApp } from "~/backend/test-app";
import { ArticlesRefreshService } from "~/backend/services/articles-refresh.service";

function envWith(d1: D1Database, bucket: R2Bucket): Env {
  return { D1: d1, R2: bucket } as unknown as Env;
}

/** 索引に記事を 1 本入れる。配信はこの行が在ることを条件にする (#316)。 */
async function seedArticle(d1: D1Database): Promise<void> {
  await new D1ArticleCommandRepository(d1).upsert(
    Article.create({
      slug: ArticleSlug.create("hello"),
      title: ArticleTitle.create("Hello"),
      summary: "A summary.",
      publishedOn: Temporal.PlainDate.from("2026-01-15"),
      lastModifiedOn: Temporal.PlainDate.from("2026-01-16"),
      status: "published",
      sourceHash: "h1",
    }),
  );
}

async function seedAsset(bucket: R2Bucket): Promise<void> {
  await new R2ArticleContentCache(bucket).putAsset(ArticleSlug.create("hello"), "cover.png", {
    bytes: new Uint8Array([1, 2, 3]),
    contentType: "image/png",
  });
}

describe("createArticleAssetsRouter GET /:slug/assets/:path", () => {
  it("serves a cached asset with its content type and cache headers", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seedArticle(d1);
    const bytes = new Uint8Array([1, 2, 3, 4]);
    await new R2ArticleContentCache(bucket).putAsset(ArticleSlug.create("hello"), "cover.png", {
      bytes,
      contentType: "image/png",
    });

    const res = await createArticleAssetsRouter().request(
      "/hello/assets/cover.png",
      {},
      envWith(d1, bucket),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Cache-Control")).toContain("max-age");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes);
  });

  it("serves assets nested under subdirectories (slash in path)", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seedArticle(d1);
    await new R2ArticleContentCache(bucket).putAsset(ArticleSlug.create("hello"), "img/a.png", {
      bytes: new Uint8Array([9]),
      contentType: "image/png",
    });

    const res = await createArticleAssetsRouter().request(
      "/hello/assets/img/a.png",
      {},
      envWith(d1, bucket),
    );
    expect(res.status).toBe(200);
  });

  it("returns 404 for a missing asset", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seedArticle(d1);
    const res = await createArticleAssetsRouter().request(
      "/hello/assets/missing.png",
      {},
      envWith(d1, bucket),
    );
    expect(res.status).toBe(404);
  });

  /*
   * 同期が cacheAssets まで進んで upsert の手前で落ちると、D1 に行の無い記事の絵が
   * R2 に残る。掃除は D1 の行を辿るので届かず、書き手が非公開にしても絵だけ配られ
   * 続けていた。スラグが推測できれば読める状態だった (#316)。
   */
  it("returns 404 when the article is not indexed, even if the asset is cached", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seedAsset(bucket);

    const res = await createArticleAssetsRouter().request(
      "/hello/assets/cover.png",
      {},
      envWith(d1, bucket),
    );

    expect(res.status).toBe(404);
  });

  /*
   * 執筆の材料 (`_materials/` など) は同期の時点で落ちる (#559)。R2 に入らないので、
   * 記事が公開されていてもアセット API からは引けない。
   */
  it("returns 404 for synced paths with a segment starting with _", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    const encode = (text: string): Uint8Array => new TextEncoder().encode(text);
    const files = new Map<string, Uint8Array>([
      [
        "articles/hello.md",
        encode(
          "---\ntitle: Hello\npublishedOn: 2026-01-15\nlastModifiedOn: 2026-01-16\n---\n\nBody.\n",
        ),
      ],
      ["articles/hello/cover.png", encode("PNG")],
      ["articles/hello/_materials/x.md", encode("secret")],
      ["articles/hello/img/_draft.png", encode("draft")],
    ]);
    const content: IContentStore = {
      listTree: (): Promise<readonly ContentEntry[]> =>
        Promise.resolve([...files.keys()].map((path) => ({ path, hash: path }))),
      readFile: (path: string): Promise<Uint8Array | undefined> => Promise.resolve(files.get(path)),
    };
    await new ArticlesRefreshService(
      content,
      new D1ArticleCommandRepository(d1),
      D1ArticleQueryRepository.forAdmin(d1),
      new R2ArticleContentCache(bucket),
      new D1ArticleSearchIndex(d1),
    ).refresh();

    const get = (path: string): Response | Promise<Response> =>
      createArticleAssetsRouter().request(`/hello/assets/${path}`, {}, envWith(d1, bucket));
    expect((await get("cover.png")).status).toBe(200);
    expect((await get("_materials/x.md")).status).toBe(404);
    expect((await get("img/_draft.png")).status).toBe(404);
  });

  it("returns 404 for an invalid slug", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    const res = await createArticleAssetsRouter().request(
      "/Invalid_Slug/assets/x.png",
      {},
      envWith(d1, bucket),
    );
    expect(res.status).toBe(404);
  });

  it("uses public cache-control when BASIC auth is off", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seedArticle(d1);
    await seedAsset(bucket);
    const res = await createArticleAssetsRouter().request(
      "/hello/assets/cover.png",
      {},
      envWith(d1, bucket),
    );
    expect(res.headers.get("Cache-Control")).toContain("public");
  });

  it("uses private cache-control when BASIC auth is enabled (staging)", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seedArticle(d1);
    await seedAsset(bucket);
    const env = {
      D1: d1,
      R2: bucket,
      BASIC_AUTH_USER: "u",
      BASIC_AUTH_PASS: "p",
    } as unknown as Env;
    const res = await createArticleAssetsRouter().request("/hello/assets/cover.png", {}, env);
    const cacheControl = res.headers.get("Cache-Control");
    expect(cacheControl).toContain("private");
    expect(cacheControl).not.toContain("public");
  });
});

describe("article asset public routing (full app)", () => {
  it("serves assets through the composed app", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seedArticle(d1);
    await seedAsset(bucket);
    const env = { R2: bucket, D1: d1 } as unknown as Env;

    const res = await createTestApp().request("/api/v1/articles/hello/assets/cover.png", {}, env);
    // React Router へ落ちず Hono 側が応答している (ダミー委譲は 404 を返す)。
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
  });
});
