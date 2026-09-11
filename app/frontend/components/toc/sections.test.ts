import { describe, expect, it } from "vitest";
import { sectionOf, toSections } from "./sections";
import type { TocHeading } from "~/backend/handlers/articles/toc-headings";

const h2 = (id: string): TocHeading => ({ id, text: id, level: 2 });
const h3 = (id: string): TocHeading => ({ id, text: id, level: 3 });

describe("toSections", () => {
  it("h3 を直前の h2 の配下に入れる", () => {
    const sections = toSections([h2("a"), h3("a-1"), h3("a-2"), h2("b")]);
    expect(sections.map((section) => section.heading.id)).toEqual(["a", "b"]);
    expect(sections[0]?.children.map((child) => child.id)).toEqual(["a-1", "a-2"]);
    expect(sections[1]?.children).toEqual([]);
  });

  // h3 から書き始めた記事でも、見出しが落ちないようにする。
  it("先頭の h3 は自分でセクションを開く", () => {
    const sections = toSections([h3("x"), h2("y")]);
    expect(sections.map((section) => section.heading.id)).toEqual(["x", "y"]);
  });

  it("見出しが無ければ空", () => {
    expect(toSections([])).toEqual([]);
  });
});

describe("sectionOf", () => {
  const sections = toSections([h2("a"), h3("a-1"), h2("b")]);

  it("h2 を読んでいるときは、その節", () => {
    expect(sectionOf(sections, "a")?.heading.id).toBe("a");
  });

  /*
   * 節の名前として出したいのは章の名前であって、章の中の小見出しではない。
   */
  it("h3 を読んでいるときは、抱えている h2 を返す", () => {
    expect(sectionOf(sections, "a-1")?.heading.id).toBe("a");
  });

  it("現在地が決まっていなければ undefined", () => {
    expect(sectionOf(sections, "")).toBeUndefined();
  });

  it("知らない id なら undefined", () => {
    expect(sectionOf(sections, "nope")).toBeUndefined();
  });
});
