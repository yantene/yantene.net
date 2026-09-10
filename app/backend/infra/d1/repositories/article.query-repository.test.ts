import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import { D1ArticleSearchIndex } from "./article-search-index";
import { D1ArticleCommandRepository } from "./article.command-repository";
import { D1ArticleQueryRepository } from "./article.query-repository";
import type { IUnpersisted } from "~/backend/domain/shared";
import { Article, ArticleSlug, ArticleTitle } from "~/backend/domain/article";
import { createTestD1 } from "~/backend/infra/d1/test-helper";

function seed(params: {
  slug: string;
  publishedOn: string;
  lastModifiedOn?: string;
}): Article<IUnpersisted> {
  return Article.create({
    slug: ArticleSlug.create(params.slug),
    title: ArticleTitle.create(params.slug),
    summary: "s",
    publishedOn: Temporal.PlainDate.from(params.publishedOn),
    lastModifiedOn: Temporal.PlainDate.from(params.lastModifiedOn ?? params.publishedOn),
    sourceHash: `hash-${params.slug}`,
  });
}

async function seedArticles(cmd: D1ArticleCommandRepository): Promise<void> {
  await cmd.upsert(seed({ slug: "a", publishedOn: "2026-01-10" }));
  await cmd.upsert(seed({ slug: "b", publishedOn: "2026-03-10" }));
  await cmd.upsert(seed({ slug: "c", publishedOn: "2026-02-10" }));
}

describe("D1ArticleQueryRepository", () => {
  it("returns undefined for an unknown slug", async () => {
    const query = new D1ArticleQueryRepository(createTestD1());
    expect(await query.findBySlug(ArticleSlug.create("nope"))).toBeUndefined();
  });

  it("finds an article by slug after upsert", async () => {
    const d1 = createTestD1();
    await new D1ArticleCommandRepository(d1).upsert(
      seed({ slug: "found", publishedOn: "2026-01-01" }),
    );
    const found = await new D1ArticleQueryRepository(d1).findBySlug(ArticleSlug.create("found"));
    expect(found?.slug.toString()).toBe("found");
  });

  it("orders by publishedOn descending by default sort field", async () => {
    const d1 = createTestD1();
    await seedArticles(new D1ArticleCommandRepository(d1));

    const { articles, total } = await new D1ArticleQueryRepository(d1).list({
      limit: 10,
      offset: 0,
      sortBy: "publishedOn",
      direction: "desc",
    });

    expect(total).toBe(3);
    expect(articles.map((n) => n.slug.toString())).toEqual(["b", "c", "a"]);
  });

  it("orders ascending when requested", async () => {
    const d1 = createTestD1();
    await seedArticles(new D1ArticleCommandRepository(d1));

    const { articles } = await new D1ArticleQueryRepository(d1).list({
      limit: 10,
      offset: 0,
      sortBy: "publishedOn",
      direction: "asc",
    });

    expect(articles.map((n) => n.slug.toString())).toEqual(["a", "c", "b"]);
  });

  it("applies limit and offset for pagination while total stays the full count", async () => {
    const d1 = createTestD1();
    await seedArticles(new D1ArticleCommandRepository(d1));

    const { articles, total } = await new D1ArticleQueryRepository(d1).list({
      limit: 1,
      offset: 1,
      sortBy: "publishedOn",
      direction: "desc",
    });

    expect(total).toBe(3);
    expect(articles.map((n) => n.slug.toString())).toEqual(["c"]);
  });

  it("returns slug -> sourceHash map for change detection", async () => {
    const d1 = createTestD1();
    await seedArticles(new D1ArticleCommandRepository(d1));

    const hashes = await new D1ArticleQueryRepository(d1).listSourceHashes();
    expect(hashes.get("a")).toBe("hash-a");
    expect(hashes.get("b")).toBe("hash-b");
    expect(hashes.size).toBe(3);
  });

  it("keeps a stable order across pages when dates tie (slug tiebreaker)", async () => {
    const d1 = createTestD1();
    const cmd = new D1ArticleCommandRepository(d1);
    // 全て同じ publishedOn。タイブレーカが無いと offset ページングで重複・欠落しうる。
    await cmd.upsert(seed({ slug: "c", publishedOn: "2026-01-15" }));
    await cmd.upsert(seed({ slug: "a", publishedOn: "2026-01-15" }));
    await cmd.upsert(seed({ slug: "b", publishedOn: "2026-01-15" }));
    const query = new D1ArticleQueryRepository(d1);

    const page1 = await query.list({
      limit: 2,
      offset: 0,
      sortBy: "publishedOn",
      direction: "desc",
    });
    const page2 = await query.list({
      limit: 2,
      offset: 2,
      sortBy: "publishedOn",
      direction: "desc",
    });

    // slug 昇順で安定 → ページをまたいで a, b, c が重複なく並ぶ。
    expect(page1.articles.map((n) => n.slug.toString())).toEqual(["a", "b"]);
    expect(page2.articles.map((n) => n.slug.toString())).toEqual(["c"]);
  });

  it("slug をまとめて引く (順序は保証しない)", async () => {
    const d1 = createTestD1();
    await seedArticles(new D1ArticleCommandRepository(d1));

    const found = await new D1ArticleQueryRepository(d1).findBySlugs(["c", "a"]);

    // 並び順は呼び出し側が決める。ここでは中身が揃っていることだけを見る。
    expect(found.map((article) => article.slug.toString()).toSorted()).toEqual(["a", "c"]);
  });

  it("知らない slug は結果に現れず、空を渡せば空が返る", async () => {
    const d1 = createTestD1();
    await seedArticles(new D1ArticleCommandRepository(d1));
    const query = new D1ArticleQueryRepository(d1);

    const found = await query.findBySlugs(["a", "nope"]);

    expect(found.map((article) => article.slug.toString())).toEqual(["a"]);
    expect(await query.findBySlugs([])).toEqual([]);
  });

  it("full-text searches title/body (FTS5 trigram, Japanese substring)", async () => {
    const d1 = createTestD1();
    const cmd = new D1ArticleCommandRepository(d1);
    const idx = new D1ArticleSearchIndex(d1);
    await cmd.upsert(seed({ slug: "arduino", publishedOn: "2026-01-01" }));
    await idx.index({
      slug: ArticleSlug.create("arduino"),
      title: "Arduino を購入",
      body: "マイコンで遊ぶ話",
    });
    await cmd.upsert(seed({ slug: "other", publishedOn: "2026-01-02" }));
    await idx.index({
      slug: ArticleSlug.create("other"),
      title: "別の記事",
      body: "関係ない内容",
    });

    const results = await new D1ArticleQueryRepository(d1).search("マイコン", 10);
    expect(results.map((article) => article.slug.toString())).toEqual(["arduino"]);
  });

  it("matches short (2-char) queries via LIKE fallback (trigram can't)", async () => {
    const d1 = createTestD1();
    const cmd = new D1ArticleCommandRepository(d1);
    const idx = new D1ArticleSearchIndex(d1);
    await cmd.upsert(seed({ slug: "exam", publishedOn: "2026-01-01" }));
    await idx.index({
      slug: ArticleSlug.create("exam"),
      title: "試験に合格した話",
      body: "勉強の記録",
    });

    const results = await new D1ArticleQueryRepository(d1).search("試験", 10);
    expect(results.map((article) => article.slug.toString())).toEqual(["exam"]);
  });

  it("returns empty search results when the index is not built", async () => {
    const d1 = createTestD1();
    // 索引は infra が実行時に作る。migration 0011 が改名のために作ってしまうので、無い状態に戻す。
    await d1.exec("DROP TABLE IF EXISTS articles_fts");
    const results = await new D1ArticleQueryRepository(d1).search("なんでも", 10);
    expect(results).toEqual([]);
  });
});
