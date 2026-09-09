import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import { D1ArticleCommandRepository } from "./article.command-repository";
import { D1ArticleQueryRepository } from "./article.query-repository";
import type { IUnpersisted } from "~/backend/domain/shared";
import { ImageUrl, Article, ArticleSlug, ArticleTitle } from "~/backend/domain/article";
import { createTestD1 } from "~/backend/infra/d1/test-helper";

function unpersistedArticle(params: {
  slug: string;
  title: string;
  summary?: string;
  imageUrl?: string;
  publishedOn?: string;
  lastModifiedOn?: string;
  sourceHash?: string;
}): Article<IUnpersisted> {
  return Article.create({
    slug: ArticleSlug.create(params.slug),
    title: ArticleTitle.create(params.title),
    summary: params.summary ?? "summary",
    imageUrl: params.imageUrl === undefined ? undefined : ImageUrl.create(params.imageUrl),
    publishedOn: Temporal.PlainDate.from(params.publishedOn ?? "2026-01-15"),
    lastModifiedOn: Temporal.PlainDate.from(params.lastModifiedOn ?? "2026-01-20"),
    sourceHash: params.sourceHash ?? "hash-0",
  });
}

describe("D1ArticleCommandRepository", () => {
  it("inserts a new article and returns it persisted", async () => {
    const cmd = new D1ArticleCommandRepository(createTestD1());

    const saved = await cmd.upsert(
      unpersistedArticle({
        slug: "hello",
        title: "Hello",
        imageUrl: "/api/v1/articles/hello/assets/cover.png",
      }),
    );

    expect(saved.id).toBeTruthy();
    expect(saved.slug.toString()).toBe("hello");
    expect(saved.title.toString()).toBe("Hello");
    expect(saved.imageUrl?.toString()).toBe("/api/v1/articles/hello/assets/cover.png");
    expect(saved.createdAt).toBeInstanceOf(Temporal.Instant);
    expect(saved.updatedAt).toBeInstanceOf(Temporal.Instant);
  });

  it("stores an article without a cover image as undefined", async () => {
    const cmd = new D1ArticleCommandRepository(createTestD1());
    const saved = await cmd.upsert(unpersistedArticle({ slug: "x", title: "X" }));
    expect(saved.imageUrl).toBeUndefined();
  });

  it("updates in place on slug conflict, keeping the same id", async () => {
    const d1 = createTestD1();
    const cmd = new D1ArticleCommandRepository(d1);
    const query = new D1ArticleQueryRepository(d1);

    const first = await cmd.upsert(unpersistedArticle({ slug: "post", title: "Original" }));
    const second = await cmd.upsert(
      unpersistedArticle({ slug: "post", title: "Updated", summary: "new" }),
    );

    expect(second.id).toBe(first.id);
    expect(second.title.toString()).toBe("Updated");
    expect(second.summary).toBe("new");
    expect(second.createdAt.equals(first.createdAt)).toBe(true);

    const { total } = await query.list({
      limit: 10,
      offset: 0,
      sortBy: "publishedOn",
      direction: "desc",
    });
    expect(total).toBe(1);
  });

  it("deletes an article by slug", async () => {
    const d1 = createTestD1();
    const cmd = new D1ArticleCommandRepository(d1);
    const query = new D1ArticleQueryRepository(d1);

    await cmd.upsert(unpersistedArticle({ slug: "gone", title: "Gone" }));
    await cmd.deleteBySlug(ArticleSlug.create("gone"));

    expect(await query.findBySlug(ArticleSlug.create("gone"))).toBeUndefined();
  });

  it("deletes an article by id", async () => {
    const d1 = createTestD1();
    const cmd = new D1ArticleCommandRepository(d1);
    const query = new D1ArticleQueryRepository(d1);

    const saved = await cmd.upsert(unpersistedArticle({ slug: "byid", title: "T" }));
    await cmd.delete(saved.id);

    expect(await query.findBySlug(ArticleSlug.create("byid"))).toBeUndefined();
  });
});
