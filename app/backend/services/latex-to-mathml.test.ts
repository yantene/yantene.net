import { describe, expect, it } from "vitest";
import { latexToMathMl, MathSyntaxError } from "./latex-to-mathml";
import type { Element, ElementContent } from "hast";

/** 木を平らにして要素だけ取り出す。allowlist や属性の検査に使う。 */
function elementsOf(nodes: readonly ElementContent[]): Element[] {
  return nodes.flatMap((node) =>
    node.type === "element" ? [node, ...elementsOf(node.children)] : [],
  );
}

function attributeNamesOf(nodes: readonly ElementContent[]): string[] {
  return elementsOf(nodes).flatMap((element) =>
    Object.keys(element.properties),
  );
}

describe("latexToMathMl", () => {
  it("returns the attributes and children of the <math> element", () => {
    const { properties, children } = latexToMathMl("a^2", { display: false });
    expect(properties.xmlns).toBe("http://www.w3.org/1998/Math/MathML");
    // KaTeX は <semantics> に組版と LaTeX 原文 (annotation) を並べて返す。
    expect(elementsOf(children).map((element) => element.tagName)).toContain(
      "msup",
    );
  });

  it("marks display math with display=block and leaves inline math bare", () => {
    expect(latexToMathMl("a", { display: true }).properties.display).toBe(
      "block",
    );
    expect(
      latexToMathMl("a", { display: false }).properties.display,
    ).toBeUndefined();
  });

  it("never emits a style attribute (CSP would drop it silently)", () => {
    const cases = [
      String.raw`\frac{-b \pm \sqrt{b^2-4ac}}{2a}`,
      String.raw`\begin{pmatrix} a & b \\ c & d \end{pmatrix}`,
      String.raw`\begin{aligned} x &= 1 \\ y &= 2 \end{aligned}`,
      String.raw`\sum_{i=1}^{n} i`,
    ];
    for (const latex of cases) {
      const { properties, children } = latexToMathMl(latex, { display: true });
      const names = [...Object.keys(properties), ...attributeNamesOf(children)];
      expect(names).not.toContain("style");
      expect(names).not.toContain("className");
    }
  });

  it("drops the position of every node (the MDAST is cached as JSON)", () => {
    const { children } = latexToMathMl("a^2", { display: false });
    for (const element of elementsOf(children)) {
      expect(element.position).toBeUndefined();
    }
  });

  it("keeps the LaTeX source as an annotation", () => {
    const { children } = latexToMathMl("a^2", { display: false });
    const annotation = elementsOf(children).find(
      (element) => element.tagName === "annotation",
    );
    expect(annotation?.properties.encoding).toBe("application/x-tex");
  });

  it("does not honour the href command (trust is off, no URL slips in)", () => {
    const { children } = latexToMathMl(
      String.raw`\href{javascript:alert(1)}{x}`,
      { display: false },
    );
    expect(attributeNamesOf(children)).not.toContain("href");
  });

  it("throws MathSyntaxError on LaTeX it cannot parse", () => {
    expect(() => latexToMathMl(String.raw`\frac{`, { display: false })).toThrow(
      MathSyntaxError,
    );
  });

  it("reports the offending source in the error message", () => {
    expect(() =>
      latexToMathMl(String.raw`\nosuchcommand`, { display: true }),
    ).toThrow(/nosuchcommand/);
  });
});
