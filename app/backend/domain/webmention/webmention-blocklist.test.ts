import { describe, expect, it } from "vitest";
import { isBlockedHost, isBlockedSource } from "./webmention-blocklist";
import { WebmentionUrl } from "./webmention-url.vo";

describe("isBlockedHost", () => {
  it("登録したホストそのものを止める", () => {
    expect(isBlockedHost("spam.example", ["spam.example"])).toBe(true);
  });

  it("登録したホストの下位ドメインも止める", () => {
    // サブドメインを取り替えながら送ってくる相手を 1 件ずつ登録して回らないため。
    expect(isBlockedHost("a.spam.example", ["spam.example"])).toBe(true);
    expect(isBlockedHost("a.b.spam.example", ["spam.example"])).toBe(true);
  });

  it("後ろが一致するだけの別ホストは止めない", () => {
    // "notspam.example" は "spam.example" の下位ドメインではない。
    expect(isBlockedHost("notspam.example", ["spam.example"])).toBe(false);
  });

  it("上位ドメインは止めない", () => {
    expect(isBlockedHost("example", ["spam.example"])).toBe(false);
  });

  it("大文字小文字を区別しない", () => {
    expect(isBlockedHost("SPAM.Example", ["spam.example"])).toBe(true);
    expect(isBlockedHost("spam.example", ["SPAM.EXAMPLE"])).toBe(true);
  });

  it("何も登録されていなければ止めない", () => {
    expect(isBlockedHost("spam.example", [])).toBe(false);
  });

  it("空文字の登録は何も止めない", () => {
    // 空を「全部に一致する」と読むと、行が 1 つ壊れただけで全員が消える。
    expect(isBlockedHost("example.com", [""])).toBe(false);
  });
});

describe("isBlockedSource", () => {
  it("送信元 URL のホストで判ずる", () => {
    const source = WebmentionUrl.create("https://a.spam.example/posts/1");
    expect(isBlockedSource(source, ["spam.example"])).toBe(true);
    expect(isBlockedSource(source, ["other.example"])).toBe(false);
  });
});
