import { Temporal } from "@js-temporal/polyfill";
import { beforeEach, describe, expect, it } from "vitest";
import { D1ArticleEmbeddingCommandRepository } from "./article-embedding.command-repository";
import { D1ArticleEmbeddingQueryRepository } from "./article-embedding.query-repository";
import { D1ArticleCommandRepository } from "./article.command-repository";
import { D1ArticleQueryRepository } from "./article.query-repository";
import type { ArticleEmbedding } from "~/backend/domain/article-embedding";
import type { EntityId } from "~/backend/domain/shared";
import { Article, ArticleSlug, ArticleTitle } from "~/backend/domain/article";
import { EmbeddingVector } from "~/backend/domain/article-embedding";
import { createTestD1 } from "~/backend/infra/d1/test-helper";

const MODEL = "@cf/pfnet/plamo-embedding-1b";

/** 記事を 1 本入れて、採番された id を返す。近さの行は外部キーで実在する記事を要求する。 */
async function seedArticle(d1: D1Database, slug: string): Promise<EntityId<"Article">> {
  await new D1ArticleCommandRepository(d1).upsert(
    Article.create({
      slug: ArticleSlug.create(slug),
      title: ArticleTitle.create(slug),
      summary: "s",
      publishedOn: Temporal.PlainDate.from("2026-01-01"),
      lastModifiedOn: Temporal.PlainDate.from("2026-01-01"),
      sourceHash: `hash-${slug}`,
    }),
  );
  const article = await new D1ArticleQueryRepository(d1).findBySlug(ArticleSlug.create(slug));
  if (article?.id === undefined) throw new Error(`failed to seed ${slug}`);
  return article.id;
}

function embedding(
  articleId: EntityId<"Article">,
  slug: string,
  values: readonly number[],
): ArticleEmbedding {
  return {
    articleId,
    slug: ArticleSlug.create(slug),
    model: MODEL,
    contentHash: `hash-${slug}`,
    vector: EmbeddingVector.create(values),
  };
}

describe("D1ArticleEmbedding リポジトリ", () => {
  let d1: D1Database;
  let command: D1ArticleEmbeddingCommandRepository;
  let query: D1ArticleEmbeddingQueryRepository;

  beforeEach(() => {
    d1 = createTestD1();
    command = new D1ArticleEmbeddingCommandRepository(d1);
    query = new D1ArticleEmbeddingQueryRepository(d1);
  });

  it("書いたベクトルを読み戻せる (BLOB の往復)", async () => {
    const id = await seedArticle(d1, "a");
    const written = embedding(id, "a", [3, 4]);
    await command.upsert(written);

    const [read] = await query.listAll();
    expect(read.slug.toString()).toBe("a");
    expect(read.model).toBe(MODEL);
    expect(read.contentHash).toBe("hash-a");
    // 保存も読み出しも正規化済みの float32 なので、ビット単位で一致する。
    expect(read.vector.equals(written.vector)).toBe(true);
    // 値そのものも見る。equals だけだと、両方が同じように壊れていても通ってしまう。
    expect(read.vector.dimensions).toBe(2);
    expect(read.vector.toJSON()[0]).toBeCloseTo(0.6, 6);
    expect(read.vector.toJSON()[1]).toBeCloseTo(0.8, 6);
  });

  it("同じ記事に 2 度書くと置き換わる", async () => {
    const id = await seedArticle(d1, "a");
    await command.upsert(embedding(id, "a", [1, 0]));
    await command.upsert(embedding(id, "a", [0, 1]));

    const all = await query.listAll();
    expect(all).toHaveLength(1);
    expect(all[0].vector.toJSON()).toEqual([0, 1]);
    expect(all[0].vector.dimensions).toBe(2);
  });

  it("近さは両方向に書かれる", async () => {
    const a = await seedArticle(d1, "a");
    const b = await seedArticle(d1, "b");
    await command.upsert(embedding(a, "a", [1, 0]));
    await command.upsert(embedding(b, "b", [1, 0]));

    await command.replaceAllSimilarities([{ articleId: a, otherArticleId: b, similarity: 0.9 }]);

    expect(await query.findRelatedSlugs(ArticleSlug.create("a"), 6)).toEqual(["b"]);
    // 片方向だけだと、後から書いた記事が古い記事の関連記事に出てこない。
    expect(await query.findRelatedSlugs(ArticleSlug.create("b"), 6)).toEqual(["a"]);
  });

  it("近い順に返し、limit で切る", async () => {
    const a = await seedArticle(d1, "a");
    const near = await seedArticle(d1, "near");
    const mid = await seedArticle(d1, "mid");
    const far = await seedArticle(d1, "far");
    await command.replaceAllSimilarities([
      { articleId: a, otherArticleId: far, similarity: 0.1 },
      { articleId: a, otherArticleId: near, similarity: 0.9 },
      { articleId: a, otherArticleId: mid, similarity: 0.5 },
    ]);

    expect(await query.findRelatedSlugs(ArticleSlug.create("a"), 6)).toEqual([
      "near",
      "mid",
      "far",
    ]);
    expect(await query.findRelatedSlugs(ArticleSlug.create("a"), 2)).toEqual(["near", "mid"]);
  });

  it("同点は slug の昇順で決まる (実行ごとに揺れない)", async () => {
    const a = await seedArticle(d1, "a");
    const x = await seedArticle(d1, "x");
    const y = await seedArticle(d1, "y");
    const z = await seedArticle(d1, "z");
    await command.replaceAllSimilarities([
      { articleId: a, otherArticleId: z, similarity: 0.5 },
      { articleId: a, otherArticleId: y, similarity: 0.5 },
      { articleId: a, otherArticleId: x, similarity: 0.5 },
    ]);

    expect(await query.findRelatedSlugs(ArticleSlug.create("a"), 6)).toEqual(["x", "y", "z"]);
  });

  it("入れ替えると、古い行は両方向とも残らない", async () => {
    const a = await seedArticle(d1, "a");
    const old = await seedArticle(d1, "old");
    const fresh = await seedArticle(d1, "fresh");
    await command.replaceAllSimilarities([{ articleId: a, otherArticleId: old, similarity: 0.9 }]);

    await command.replaceAllSimilarities([
      { articleId: a, otherArticleId: fresh, similarity: 0.8 },
    ]);

    expect(await query.findRelatedSlugs(ArticleSlug.create("a"), 6)).toEqual(["fresh"]);
    // 逆向きの行も消えていること。消し漏らすと old の関連記事に a が残り続ける。
    expect(await query.findRelatedSlugs(ArticleSlug.create("old"), 6)).toEqual([]);
  });

  it("バインドパラメータの上限を越える件数でも書ける", async () => {
    const a = await seedArticle(d1, "a");
    // 1 文 30 行で切って batch に積むので、2 文以上に分かれる数を渡す (20 ペア = 両方向 40 行)。
    const others = [];
    for (let index = 0; index < 20; index++) {
      others.push(await seedArticle(d1, `n${index.toString().padStart(2, "0")}`));
    }

    await command.replaceAllSimilarities(
      others.map((otherArticleId, index) => ({
        articleId: a,
        otherArticleId,
        similarity: index / 100,
      })),
    );

    const related = await query.findRelatedSlugs(ArticleSlug.create("a"), 100);
    expect(related).toHaveLength(20);
    expect(related[0]).toBe("n19");
  });

  it("記事が消えたあと、残った行を掃除できる", async () => {
    const a = await seedArticle(d1, "a");
    const b = await seedArticle(d1, "b");
    await command.upsert(embedding(a, "a", [1, 0]));
    await command.upsert(embedding(b, "b", [0, 1]));
    await command.replaceAllSimilarities([{ articleId: a, otherArticleId: b, similarity: 0.9 }]);

    // 記事の同期が先に記事を消す。こちらから slug を辿ることはもうできない。
    await d1.prepare("DELETE FROM articles WHERE slug = ?").bind("a").run();
    await command.deleteOrphans();

    expect((await query.listAll()).map((item) => item.slug.toString())).toEqual(["b"]);
    expect(await query.findRelatedSlugs(ArticleSlug.create("b"), 6)).toEqual([]);
  });

  it("消えた記事が無ければ、掃除しても何も減らない", async () => {
    const a = await seedArticle(d1, "a");
    const b = await seedArticle(d1, "b");
    await command.upsert(embedding(a, "a", [1, 0]));
    await command.upsert(embedding(b, "b", [0, 1]));
    await command.replaceAllSimilarities([{ articleId: a, otherArticleId: b, similarity: 0.9 }]);

    await command.deleteOrphans();

    expect(await query.listAll()).toHaveLength(2);
    expect(await query.findRelatedSlugs(ArticleSlug.create("a"), 6)).toEqual(["b"]);
  });

  it("ベクトルが 1 本も無ければ空を返す", async () => {
    expect(await query.listAll()).toEqual([]);
    expect(await query.findRelatedSlugs(ArticleSlug.create("nope"), 6)).toEqual([]);
  });
});
