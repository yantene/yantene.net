import { describe, expect, it } from "vitest";
import { InvalidTaglineError, Tagline } from "./tagline.vo";

describe("Tagline", () => {
  it("keeps the line breaks the writer put in", () => {
    const tagline = Tagline.create("1 行目\n2 行目");
    expect(tagline.lines()).toEqual(["1 行目", "2 行目"]);
  });

  /** YAML の `|` は末尾に改行を 1 つ残す。空の行が最後に出ないように落とす。 */
  it("drops the trailing newline that block scalars leave behind", () => {
    expect(Tagline.create("1 行目\n2 行目\n").lines()).toEqual(["1 行目", "2 行目"]);
  });

  it("rejects an empty tagline", () => {
    expect(() => Tagline.create("")).toThrow(InvalidTaglineError);
    expect(() => Tagline.create("   \n  ")).toThrow(InvalidTaglineError);
  });

  it("rejects a tagline that is too long to be short", () => {
    expect(() => Tagline.create("あ".repeat(501))).toThrow(InvalidTaglineError);
  });
});
