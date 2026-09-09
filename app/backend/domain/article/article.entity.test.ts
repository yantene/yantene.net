import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import { ImageUrl } from "./image-url.vo";
import { ArticleSlug } from "./article-slug.vo";
import { ArticleTitle } from "./article-title.vo";
import { Article } from "./article.entity";
import { entityId } from "~/backend/domain/shared";

const slug = ArticleSlug.create("my-article");
const title = ArticleTitle.create("My Article");
const publishedOn = Temporal.PlainDate.from("2026-01-15");
const lastModifiedOn = Temporal.PlainDate.from("2026-01-20");

describe("Article.create", () => {
  it("builds an unpersisted article with undefined id and timestamps", () => {
    const article = Article.create({
      slug,
      title,
      summary: "A short summary.",
      publishedOn,
      lastModifiedOn,
      sourceHash: "abc123",
    });

    expect(article.id).toBeUndefined();
    expect(article.sourceHash).toBe("abc123");
    expect(article.createdAt).toBeUndefined();
    expect(article.updatedAt).toBeUndefined();
    expect(article.slug.toString()).toBe("my-article");
    expect(article.title.toString()).toBe("My Article");
    expect(article.summary).toBe("A short summary.");
    expect(article.imageUrl).toBeUndefined();
    expect(article.publishedOn.toString()).toBe("2026-01-15");
    expect(article.lastModifiedOn.toString()).toBe("2026-01-20");
  });

  it("retains an optional cover image", () => {
    const article = Article.create({
      slug,
      title,
      summary: "s",
      imageUrl: ImageUrl.create("/api/v1/articles/my-article/assets/cover.png"),
      publishedOn,
      lastModifiedOn,
      sourceHash: "h",
    });

    expect(article.imageUrl?.toString()).toBe("/api/v1/articles/my-article/assets/cover.png");
  });
});

describe("Article.reconstruct", () => {
  it("restores a persisted article with id and timestamps", () => {
    const createdAt = Temporal.Instant.from("2026-01-15T00:00:00Z");
    const updatedAt = Temporal.Instant.from("2026-01-20T00:00:00Z");
    const article = Article.reconstruct({
      id: entityId<"Article">("article-1"),
      slug,
      title,
      summary: "s",
      imageUrl: undefined,
      publishedOn,
      lastModifiedOn,
      sourceHash: "h",
      createdAt,
      updatedAt,
    });

    expect(article.id).toBe("article-1");
    expect(article.createdAt.equals(createdAt)).toBe(true);
    expect(article.updatedAt.equals(updatedAt)).toBe(true);
  });
});
