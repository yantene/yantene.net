import { describe, expect, it, vi } from "vitest";
import { ArticlePreviewClient } from "./article-preview-client";
import type { ArticlePreview } from "~/backend/handlers/articles/preview.handler";

const preview: ArticlePreview = {
  slug: "hello",
  title: "Hello",
  summary: "A summary.",
  publishedOn: "2026-01-15",
  imageUrl: null,
  language: "ja",
};

const ok = (): Promise<Response> => Promise.resolve(Response.json(preview));
const notFound = (): Promise<Response> => Promise.resolve(new Response("{}", { status: 404 }));

describe("ArticlePreviewClient", () => {
  it("asks the preview API for the slug", async () => {
    const fetcher = vi.fn(ok);
    const client = new ArticlePreviewClient(fetcher);

    expect(await client.load("hello")).toEqual(preview);
    expect(fetcher).toHaveBeenCalledWith("/api/v1/articles/hello/preview");
  });

  it("does not ask twice for the same article", async () => {
    const fetcher = vi.fn(ok);
    const client = new ArticlePreviewClient(fetcher);

    await client.load("hello");
    await client.load("hello");

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("shares one request between hovers that overlap", async () => {
    const fetcher = vi.fn(ok);
    const client = new ArticlePreviewClient(fetcher);

    // 1 本目の応答を待たずに 2 本目を頼む。
    await Promise.all([client.load("hello"), client.load("hello")]);

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("remembers that an article is not visible", async () => {
    const fetcher = vi.fn(notFound);
    const client = new ArticlePreviewClient(fetcher);

    expect(await client.load("draft")).toBeNull();
    expect(await client.load("draft")).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("asks again after a failed request instead of remembering the failure", async () => {
    const fetcher = vi
      .fn<() => Promise<Response>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockImplementationOnce(ok);
    const client = new ArticlePreviewClient(fetcher);

    expect(await client.load("hello")).toBeNull();
    expect(await client.load("hello")).toEqual(preview);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("treats a server error as a failure, not as a hidden article", async () => {
    const fetcher = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(new Response("oops", { status: 500 }))
      .mockImplementationOnce(ok);
    const client = new ArticlePreviewClient(fetcher);

    expect(await client.load("hello")).toBeNull();
    expect(await client.load("hello")).toEqual(preview);
  });
});
