import { describe, expect, it } from "vitest";
import { normalizeEmbedSrc } from "./embed";

describe("normalizeEmbedSrc", () => {
  it("YouTube の埋め込みを通し、cookie を置かない側へ寄せる", () => {
    expect(normalizeEmbedSrc("https://www.youtube.com/embed/abc123")).toBe(
      "https://www.youtube-nocookie.com/embed/abc123",
    );
  });

  it("プロトコルを省いた書き方でも https に倒す", () => {
    expect(normalizeEmbedSrc("//www.youtube.com/embed/abc123")).toBe(
      "https://www.youtube-nocookie.com/embed/abc123",
    );
  });

  it("再生位置などのクエリは保つ", () => {
    expect(normalizeEmbedSrc("//www.youtube.com/embed/abc123?start=9007")).toBe(
      "https://www.youtube-nocookie.com/embed/abc123?start=9007",
    );
  });

  it("すでに nocookie でもそのまま通る", () => {
    expect(normalizeEmbedSrc("https://www.youtube-nocookie.com/embed/abc123")).toBe(
      "https://www.youtube-nocookie.com/embed/abc123",
    );
  });

  it("知らない相手は通さない", () => {
    expect(normalizeEmbedSrc("https://evil.example/embed/x")).toBeNull();
    // ホスト名に youtube を含むだけの別ドメイン。
    expect(normalizeEmbedSrc("https://youtube.com.evil.example/embed/x")).toBeNull();
  });

  it("埋め込み以外のパスは通さない", () => {
    expect(normalizeEmbedSrc("https://www.youtube.com/watch?v=abc")).toBeNull();
    expect(normalizeEmbedSrc("https://www.youtube.com/")).toBeNull();
    expect(normalizeEmbedSrc("https://www.youtube.com/embed/")).toBeNull();
  });

  it("URL として読めないものは通さない", () => {
    expect(normalizeEmbedSrc("javascript:alert(1)")).toBeNull();
    expect(normalizeEmbedSrc("")).toBeNull();
    expect(normalizeEmbedSrc("/embed/abc")).toBeNull();
  });
});
