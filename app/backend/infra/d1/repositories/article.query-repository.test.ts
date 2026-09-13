import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import { D1ArticleSearchIndex } from "./article-search-index";
import { D1ArticleCommandRepository } from "./article.command-repository";
import { D1ArticleQueryRepository } from "./article.query-repository";
import type { IUnpersisted } from "~/backend/domain/shared";
import type { ArticleStatus } from "~/backend/domain/article";
import { Article, ArticleSlug, ArticleTitle, articleStatuses } from "~/backend/domain/article";
import { createTestD1 } from "~/backend/infra/d1/test-helper";

function seed(params: {
  slug: string;
  publishedOn: string;
  lastModifiedOn?: string;
  status?: ArticleStatus;
}): Article<IUnpersisted> {
  return Article.create({
    slug: ArticleSlug.create(params.slug),
    title: ArticleTitle.create(params.slug),
    summary: "s",
    publishedOn: Temporal.PlainDate.from(params.publishedOn),
    lastModifiedOn: Temporal.PlainDate.from(params.lastModifiedOn ?? params.publishedOn),
    status: params.status ?? "published",
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
    const query = D1ArticleQueryRepository.forReaders(createTestD1());
    expect(await query.findBySlug(ArticleSlug.create("nope"))).toBeUndefined();
  });

  it("finds an article by slug after upsert", async () => {
    const d1 = createTestD1();
    await new D1ArticleCommandRepository(d1).upsert(
      seed({ slug: "found", publishedOn: "2026-01-01" }),
    );
    const found = await D1ArticleQueryRepository.forReaders(d1).findBySlug(
      ArticleSlug.create("found"),
    );
    expect(found?.slug.toString()).toBe("found");
  });

  it("orders by publishedOn descending by default sort field", async () => {
    const d1 = createTestD1();
    await seedArticles(new D1ArticleCommandRepository(d1));

    const { articles, total } = await D1ArticleQueryRepository.forReaders(d1).list({
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

    const { articles } = await D1ArticleQueryRepository.forReaders(d1).list({
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

    const { articles, total } = await D1ArticleQueryRepository.forReaders(d1).list({
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

    const hashes = await D1ArticleQueryRepository.forReaders(d1).listSourceHashes();
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
    const query = D1ArticleQueryRepository.forReaders(d1);

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

    const found = await D1ArticleQueryRepository.forReaders(d1).findBySlugs(["c", "a"]);

    // 並び順は呼び出し側が決める。ここでは中身が揃っていることだけを見る。
    expect(found.map((article) => article.slug.toString()).toSorted()).toEqual(["a", "c"]);
  });

  it("知らない slug は結果に現れず、空を渡せば空が返る", async () => {
    const d1 = createTestD1();
    await seedArticles(new D1ArticleCommandRepository(d1));
    const query = D1ArticleQueryRepository.forReaders(d1);

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

    const results = await D1ArticleQueryRepository.forReaders(d1).search("マイコン", 10);
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

    const results = await D1ArticleQueryRepository.forReaders(d1).search("試験", 10);
    expect(results.map((article) => article.slug.toString())).toEqual(["exam"]);
  });

  it("returns empty search results when the index is not built", async () => {
    const d1 = createTestD1();
    // 索引は infra が実行時に作る。migration 0011 が改名のために作ってしまうので、無い状態に戻す。
    await d1.exec("DROP TABLE IF EXISTS articles_fts");
    const results = await D1ArticleQueryRepository.forReaders(d1).search("なんでも", 10);
    expect(results).toEqual([]);
  });
});

/*
 * ADR 0040 の「検証方法」。
 *
 * この class の不変条件は 1 つ — **forReaders は published 以外を返さない**
 * (findBySlug だけは unlisted も返す)。ここが緩むと、新しい配信経路を書く人が
 * 何も間違えていないのに下書きが漏れる。
 */
describe("forReaders / forAdmin (ADR 0040)", () => {
  const hidden = articleStatuses.filter((status) => status !== "published");

  /** published 1 本と、指定した status の 1 本を入れる。 */
  async function seedPair(status: ArticleStatus): Promise<D1Database> {
    const d1 = createTestD1();
    const cmd = new D1ArticleCommandRepository(d1);
    await cmd.upsert(seed({ slug: "shown", publishedOn: "2026-01-10" }));
    await cmd.upsert(seed({ slug: "hidden", publishedOn: "2026-02-10", status }));
    return d1;
  }

  describe.each(hidden)("%s", (status) => {
    it("list に出ない (総件数も数えない)", async () => {
      const query = D1ArticleQueryRepository.forReaders(await seedPair(status));
      const result = await query.list({
        limit: 10,
        offset: 0,
        sortBy: "publishedOn",
        direction: "desc",
      });
      expect(result.articles.map((article) => article.slug.toString())).toEqual(["shown"]);
      // 行だけ絞って総数を絞り忘れると、ページャが在りもしないページを指す。
      expect(result.total).toBe(1);
    });

    it("findBySlugs (関連記事) に出ない", async () => {
      const query = D1ArticleQueryRepository.forReaders(await seedPair(status));
      const found = await query.findBySlugs(["shown", "hidden"]);
      expect(found.map((article) => article.slug.toString())).toEqual(["shown"]);
    });

    it("findByIds (人気順) に出ない", async () => {
      const d1 = await seedPair(status);
      const admin = D1ArticleQueryRepository.forAdmin(d1);
      const all = await admin.list({
        limit: 10,
        offset: 0,
        sortBy: "publishedOn",
        direction: "desc",
      });
      const ids = all.articles.map((article) => article.id);
      expect(ids).toHaveLength(2);

      const query = D1ArticleQueryRepository.forReaders(d1);
      const found = await query.findByIds(ids);
      expect(found.map((article) => article.slug.toString())).toEqual(["shown"]);
    });

    it("forAdmin なら list に出る", async () => {
      const query = D1ArticleQueryRepository.forAdmin(await seedPair(status));
      const result = await query.list({
        limit: 10,
        offset: 0,
        sortBy: "publishedOn",
        direction: "desc",
      });
      expect(result.articles.map((article) => article.slug.toString()).toSorted()).toEqual([
        "hidden",
        "shown",
      ]);
      expect(result.total).toBe(2);
    });
  });

  /*
   * findBySlug だけは unlisted を通す。URL を知っていれば読める、が unlisted の定義。
   * 守るのは「一覧と検索から辿れないこと」であって、秘密にすることではない。
   */
  it("findBySlug は unlisted を返す", async () => {
    const query = D1ArticleQueryRepository.forReaders(await seedPair("unlisted"));
    expect(await query.findBySlug(ArticleSlug.create("hidden"))).toBeDefined();
  });

  it.each(["withdrawn", "draft", "idea"] as const)(
    "findBySlug は %s を返さない",
    async (status) => {
      const query = D1ArticleQueryRepository.forReaders(await seedPair(status));
      expect(await query.findBySlug(ArticleSlug.create("hidden"))).toBeUndefined();
    },
  );

  it.each(hidden)("forAdmin の findBySlug は %s を返す", async (status) => {
    const query = D1ArticleQueryRepository.forAdmin(await seedPair(status));
    expect(await query.findBySlug(ArticleSlug.create("hidden"))).toBeDefined();
  });

  /*
   * refresh は掃除の判定に全 status が要る。forReaders で引くと下書きが落ち、
   * コンテンツリポジトリから消えた下書きが D1 に残り続ける。
   */
  it("listSourceHashes は forAdmin なら全 status を返す", async () => {
    const d1 = await seedPair("draft");
    expect(
      [...(await D1ArticleQueryRepository.forAdmin(d1).listSourceHashes()).keys()].toSorted(),
    ).toEqual(["hidden", "shown"]);
    expect([...(await D1ArticleQueryRepository.forReaders(d1).listSourceHashes()).keys()]).toEqual([
      "shown",
    ]);
  });
});
