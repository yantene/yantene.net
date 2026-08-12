import { describe, expect, it } from "vitest";
import { linkCardIdFor } from "./link-card-id";
import { LinkCardUrl } from "./link-card-url.vo";

describe("linkCardIdFor", () => {
  it("同じ URL からは常に同じ id が出る", async () => {
    const url = LinkCardUrl.create("https://example.com/a");
    expect(await linkCardIdFor(url)).toBe(await linkCardIdFor(url));
  });

  it("違う URL からは違う id が出る", async () => {
    const a = await linkCardIdFor(LinkCardUrl.create("https://example.com/a"));
    const b = await linkCardIdFor(LinkCardUrl.create("https://example.com/b"));
    expect(a).not.toBe(b);
  });

  it("URL パスに埋められる 16 進 32 文字になる", async () => {
    const id = await linkCardIdFor(LinkCardUrl.create("https://example.com/a"));
    expect(id).toMatch(/^[0-9a-f]{32}$/);
  });
});
