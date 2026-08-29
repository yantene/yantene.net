import { describe, expect, it } from "vitest";
import { latexToMathMl, MathSyntaxError } from "./latex-to-mathml";
import type { Element, ElementContent } from "hast";

/** 木を平らにして要素だけ取り出す。allowlist や属性の検査に使う。 */
function elementsOf(nodes: readonly ElementContent[]): Element[] {
  return nodes.flatMap((node) =>
    node.type === "element" ? [node, ...elementsOf(node.children)] : [],
  );
}

/**
 * 組版の要点をひととおり通す式。
 *
 * Temml が inline style を出す形 (表組み・別行立て・`\dfrac` など) を必ず含めること。
 * 上流が値や書き方を変えたら、この一覧を通すテストが落ちる (ADR 0018)。
 */
const typesettingCases = [
  String.raw`\log w(t) = \frac{t - t_0}{H} \ln 2`,
  String.raw`\frac{-b \pm \sqrt{b^2-4ac}}{2a}`,
  String.raw`\begin{pmatrix} a & b \\ c & d \end{pmatrix}`,
  String.raw`\begin{bmatrix} a & b \\ c & d \end{bmatrix}`,
  String.raw`\begin{vmatrix} a & b \\ c & d \end{vmatrix}`,
  String.raw`\begin{cases} x & (x>0) \\ -x & (x<0) \end{cases}`,
  String.raw`\begin{aligned} x &= 1 \\ y &= 2 \end{aligned}`,
  String.raw`\begin{alignedat}{2} x &= 1 & y &= 2 \end{alignedat}`,
  String.raw`\begin{gathered} x = 1 \\ y = 2 \end{gathered}`,
  String.raw`\begin{split} x &= 1 \\ &= 2 \end{split}`,
  String.raw`\begin{array}{cc} a & b \\ c & d \end{array}`,
  String.raw`\sum_{\substack{i=1 \\ j=2}} x`,
  String.raw`\sum_{i=1}^{n} x_i = \int_0^\infty f(x)\,dx`,
  String.raw`\dfrac{a}{b} \quad \tfrac{c}{d} \quad \binom{n}{k}`,
  String.raw`\overbrace{x+y}^{a} \quad \underbrace{x+y}_{b}`,
  String.raw`\lim_{x \to 0} \frac{f(x+h)-f(x)}{h}`,
  String.raw`\left( \frac{a}{b} \right] \quad \langle x, y \rangle`,
  String.raw`\text{速さ} = \frac{\text{距離}}{\text{時間}}`,
  String.raw`\color{red}{x} \quad \xrightarrow{f}`,
  String.raw`A \subseteq B \iff \forall x \in A`,
  // 以下は「落とす」側の宣言 (width / padding / position / height / border) を出すもの。
  String.raw`\begin{align} x &= 1 \\ y &= 2 \end{align}`,
  String.raw`\begin{align*} x &= 1 \\ y &= 2 \end{align*}`,
  String.raw`\begin{equation} x = 1 \end{equation}`,
  String.raw`\begin{smallmatrix} a & b \\ c & d \end{smallmatrix}`,
  String.raw`\begin{array}{l|r} a & b \\ c & d \end{array}`,
  String.raw`\mathllap{x} + y`,
  String.raw`\boxed{x} \quad \colorbox{red}{y} \quad \raisebox{1em}{z}`,
  String.raw`\tag{1} x = 1`,
] as const;

describe("latexToMathMl", () => {
  it("returns the attributes and children of the <math> element", () => {
    const { properties, children } = latexToMathMl("a^2", { display: false });
    expect(properties.xmlns).toBe("http://www.w3.org/1998/Math/MathML");
    // KaTeX は <semantics> に組版と LaTeX 原文 (annotation) を並べて返す。
    expect(elementsOf(children).map((element) => element.tagName)).toContain("msup");
  });

  it("marks display math with display=block and leaves inline math bare", () => {
    expect(latexToMathMl("a", { display: true }).properties.display).toBe("block");
    expect(latexToMathMl("a", { display: false }).properties.display).toBeUndefined();
  });

  /*
   * Temml の inline style はそのまま通す (ADR 0019)。以前は CSP に落とされるのを避けて
   * MathML の中へ移し替えていたが、その後処理がこのモジュールの大半を占めていた。
   * `style-src` に `'unsafe-inline'` を置いたので、素通しでよくなった。
   */
  it("passes Temml's inline style through (style-src allows it now)", () => {
    const { children } = latexToMathMl(String.raw`\begin{pmatrix} a & b \\ c & d \end{pmatrix}`, {
      display: true,
    });

    // 桁の空きは Temml が style で渡してくる。落とすと行列の桁が揃わない。
    const styles = elementsOf(children)
      .map((element) => element.properties.style)
      .filter((style) => typeof style === "string");
    expect(styles.join(" ")).toContain("padding");
  });

  /*
   * 組版の要点だけ固定する。上流を上げたときにここが落ちたら、見た目を確かめること。
   */
  it("keeps the thin space Temml puts after a function name", () => {
    const { children } = latexToMathMl(String.raw`\log w(t)`, {
      display: true,
    });

    /*
     * TeX は関数名の後ろに 3/18 em を入れる。MathML Core の operator dictionary は
     * 関数適用 (U+2061) の rspace を 0 と定めているので、上流がこの mspace を
     * 出さなくなると `logw(t)` と地続きに組まれる。
     */
    const widths = elementsOf(children)
      .filter((element) => element.tagName === "mspace")
      .map((element) => element.properties.width);
    expect(widths).toContain("0.1667em");
  });

  /** 装飾の要る書き方も、式ごと落とさずに組めること。 */
  it("typesets markup that needs CSS to draw (boxed, rules, numbering)", () => {
    for (const latex of typesettingCases) {
      const { children } = latexToMathMl(latex, { display: true });
      expect(elementsOf(children).length).toBeGreaterThan(0);
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
    const annotation = elementsOf(children).find((element) => element.tagName === "annotation");
    expect(annotation?.properties.encoding).toBe("application/x-tex");
  });

  it("does not honour the href command (trust is off, no URL slips in)", () => {
    // Temml は trust: false のとき \href そのものを受け付けない (KaTeX は無視して通していた)。
    expect(() =>
      latexToMathMl(String.raw`\href{javascript:alert(1)}{x}`, {
        display: false,
      }),
    ).toThrow(MathSyntaxError);
  });

  it("throws MathSyntaxError on LaTeX it cannot parse", () => {
    expect(() => latexToMathMl(String.raw`\frac{`, { display: false })).toThrow(MathSyntaxError);
  });

  it("reports the offending source in the error message", () => {
    expect(() => latexToMathMl(String.raw`\nosuchcommand`, { display: true })).toThrow(
      /nosuchcommand/,
    );
  });
});
