import { describe, expect, it } from "vitest";
import { displayUrl } from "./display-url";

describe("displayUrl", () => {
  it("drops the scheme", () => {
    expect(displayUrl("https://github.com/yantene/infoholick")).toBe(
      "github.com/yantene/infoholick",
    );
  });

  /** `example.com/` は `example.com` と同じ場所なので、末尾の `/` は出さない。 */
  it("drops a bare trailing slash", () => {
    expect(displayUrl("https://example.com/")).toBe("example.com");
  });

  it("keeps the query and the fragment", () => {
    expect(displayUrl("https://example.com/a?b=1#c")).toBe("example.com/a?b=1#c");
  });

  /** 握って空文字にすると「在り処があるのに何も出ない」項目ができる。 */
  it("returns an unreadable url as written", () => {
    expect(displayUrl("not a url")).toBe("not a url");
  });
});
