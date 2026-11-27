import { describe, expect, it } from "vitest";
import { estimateReadingMinutes } from "./reading-time";
import type { Paragraph, Root } from "mdast";

const paragraph = (value: string): Paragraph => ({
  type: "paragraph",
  children: [{ type: "text", value }],
});

const root = (...children: Root["children"]): Root => ({ type: "root", children });

describe("estimateReadingMinutes", () => {
  it("本文の字数を 1 分 500 字で割って丸める", () => {
    expect(estimateReadingMinutes(root(paragraph("あ".repeat(4000))))).toBe(8);
    expect(estimateReadingMinutes(root(paragraph("あ".repeat(1240))))).toBe(2);
  });

  it("短い記事も 1 分と言う (0 分にはしない)", () => {
    expect(estimateReadingMinutes(root(paragraph("短い")))).toBe(1);
    expect(estimateReadingMinutes(root())).toBe(1);
  });

  it("空白は字に数えない", () => {
    expect(estimateReadingMinutes(root(paragraph(`${"a ".repeat(1000)}\n`)))).toBe(2);
  });

  /* コードと数式と生の HTML は、字数と読む時間が釣り合わないので数えない。 */
  it("コード・数式・生の HTML を数えない", () => {
    const tree = root(
      paragraph("あ".repeat(1000)),
      { type: "code", value: "x".repeat(10_000) },
      { type: "html", value: `<div>${"x".repeat(10_000)}</div>` },
      { type: "math", value: "\\frac{a}{b}".repeat(1000) },
      {
        type: "paragraph",
        children: [{ type: "inlineMath", value: "x".repeat(10_000) }],
      },
    );
    expect(estimateReadingMinutes(tree)).toBe(2);
  });

  it("見出しやリストの中の字も数える", () => {
    const tree = root(
      { type: "heading", depth: 2, children: [{ type: "text", value: "あ".repeat(500) }] },
      {
        type: "list",
        children: [{ type: "listItem", children: [paragraph("あ".repeat(500))] }],
      },
    );
    expect(estimateReadingMinutes(tree)).toBe(2);
  });
});
