import { describe, expect, it } from "vitest";
import { InvalidLinkCardUrlError } from "./errors";
import { LinkCardUrl } from "./link-card-url.vo";

describe("LinkCardUrl", () => {
  it("http / https を受け入れる", () => {
    expect(LinkCardUrl.create("https://example.com/a").toString()).toBe("https://example.com/a");
    expect(LinkCardUrl.create("https://example.com/a").toString()).toBe("https://example.com/a");
  });

  it("書かれたままの文字列を保つ (正規化しない)", () => {
    // 描画側は本文の MDAST に書かれた文字列でカードを引く。ここで形を変えると引けなくなる。
    const raw = "https://Example.com:443/a/?b=1#c";
    expect(LinkCardUrl.create(raw).toString()).toBe(raw);
  });

  it("URL でない文字列を拒む", () => {
    expect(() => LinkCardUrl.create("not a url")).toThrow(InvalidLinkCardUrlError);
  });

  it("http / https 以外のスキームを拒む", () => {
    expect(() => LinkCardUrl.create("mailto:foo@example.com")).toThrow(InvalidLinkCardUrlError);
    expect(() => LinkCardUrl.create("javascript:alert(1)")).toThrow(InvalidLinkCardUrlError);
  });

  it("同じ文字列どうしを等しいとみなす", () => {
    const a = LinkCardUrl.create("https://example.com/a");
    const b = LinkCardUrl.create("https://example.com/a");
    expect(a.equals(b)).toBe(true);
  });

  it("JSON では文字列になる", () => {
    expect(JSON.stringify(LinkCardUrl.create("https://example.com/a"))).toBe(
      '"https://example.com/a"',
    );
  });
});
