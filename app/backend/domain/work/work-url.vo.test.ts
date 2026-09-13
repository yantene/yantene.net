import { describe, expect, it } from "vitest";
import { InvalidWorkUrlError, WorkUrl } from "./work-url.vo";

describe("WorkUrl", () => {
  it("keeps an absolute https URL as written", () => {
    expect(WorkUrl.create("https://github.com/yantene/infoholick").toString()).toBe(
      "https://github.com/yantene/infoholick",
    );
  });

  it("accepts http as well", () => {
    expect(WorkUrl.create("http://example.com/").toString()).toBe("http://example.com/");
  });

  it.each([
    ["空", ""],
    ["相対パス", "/works/infoholick"],
    ["スキームだけ違う", "ftp://example.com/"],
  ])("%s は弾く", (_label, raw) => {
    expect(() => WorkUrl.create(raw)).toThrow(InvalidWorkUrlError);
  });

  /** 打ち間違いがそのまま href に乗る経路をドメインの外に作らない。 */
  it("rejects javascript:", () => {
    expect(() => WorkUrl.create("javascript:alert(1)")).toThrow(InvalidWorkUrlError);
  });
});
