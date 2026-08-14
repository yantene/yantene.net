import { render, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MdastRenderer } from "./mdast-renderer";
import type { Root as MdastRoot } from "mdast";

/*
 * Mermaid 本体は動かさず、差し替える。
 *
 * 図の組版には SVG のテキスト計測 (`getBBox` / `getComputedTextLength`) が要るが、
 * happy-dom はこれらを持たない。実物を通すと**どんな正しいソースでも失敗する**ので、
 * フォールバックの経路しか通らなくなり、成功したときの配線を確かめられない。
 *
 * **ここで固定できるのは配線だけである。** 次はこのテストでは検証していない。
 *
 * - Mermaid が実際にそのソースを図に組めるかどうか (構文の可否そのもの)
 * - 出来上がった図の見た目・テーマ・字
 * - Mermaid が SVG の中に差し込む `<style>` が CSP (`style-src`) を通るかどうか
 *
 * これらは Storybook と `pnpm run preview:staging` で目視で確かめる (ADR 0023)。
 */
const mermaid = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn(),
}));

vi.mock("mermaid", () => ({ default: mermaid }));

const DIAGRAM = "graph TD;\n  A-->B;";
const SVG = '<svg id="x" role="graphics-document document"><g></g></svg>';

function md(markdown: string): MdastRoot {
  return unified().use(remarkParse).parse(markdown);
}

function fence(language: string, body: string): MdastRoot {
  return md(`\`\`\`${language}\n${body}\n\`\`\``);
}

describe("MermaidDiagram", () => {
  beforeEach(() => {
    mermaid.render.mockReset();
  });

  it("mermaid のコードフェンスを、組み上がった SVG に差し替える", async () => {
    mermaid.render.mockResolvedValue({ svg: SVG, diagramType: "flowchart" });

    const { container } = render(
      <MdastRenderer node={fence("mermaid", DIAGRAM)} />,
    );

    // 差し替わる前 (= サーバーが返す形) はソースがそのまま出ている。
    expect(container.querySelector(":scope pre code")?.textContent).toContain(
      "graph TD;",
    );

    await waitFor(() => {
      expect(
        container.querySelector(":scope .mermaid-diagram svg"),
      ).not.toBeNull();
    });
    // 図になったらコードブロックは残さない。
    expect(container.querySelector("pre")).toBeNull();
  });

  it("フェンスの中身をそのまま Mermaid に渡す", async () => {
    mermaid.render.mockResolvedValue({ svg: SVG, diagramType: "flowchart" });

    render(<MdastRenderer node={fence("mermaid", DIAGRAM)} />);

    await waitFor(() => {
      expect(mermaid.render).toHaveBeenCalled();
    });
    const [, text] = mermaid.render.mock.calls[0] as [string, string];
    expect(text).toContain(DIAGRAM);
  });

  /*
   * Mermaid は渡した id を DOM の id にも、生成する CSS のセレクタにも使う。React の
   * `useId()` は記号を含む文字列を返すので (`«r0»` / `:r0:`)、素通しすると読めない
   * セレクタになり、例外を出さないまま図の配色だけが落ちる。
   */
  it("Mermaid に渡す id に、セレクタを壊す記号を混ぜない", async () => {
    mermaid.render.mockResolvedValue({ svg: SVG, diagramType: "flowchart" });

    render(<MdastRenderer node={fence("mermaid", DIAGRAM)} />);

    await waitFor(() => {
      expect(mermaid.render).toHaveBeenCalled();
    });
    const [id] = mermaid.render.mock.calls[0] as [string, string];
    expect(id).toMatch(/^[\w-]+$/);
  });

  it("図に組めなければ、元のコードブロックをそのまま残す", async () => {
    mermaid.render.mockRejectedValue(new Error("Parse error on line 1"));

    const { container } = render(
      <MdastRenderer node={fence("mermaid", "graph TD; A-->")} />,
    );

    // 読み込み中の印が下りたら決着が付いている。
    await waitFor(() => {
      expect(container.querySelector(".mermaid-source")).toHaveAttribute(
        "aria-busy",
        "false",
      );
    });
    expect(container.querySelector(":scope pre code")?.textContent).toContain(
      "graph TD;",
    );
    expect(container.querySelector("svg")).toBeNull();
  });

  it("mermaid 以外の言語のコードブロックには手を触れない", () => {
    const { container } = render(
      <MdastRenderer node={fence("ts", "const x = 1;")} />,
    );

    expect(container.querySelector(".mermaid-source")).toBeNull();
    expect(container.querySelector(".mermaid-diagram")).toBeNull();
    expect(container.querySelector(":scope pre code")?.className).toContain(
      "language-ts",
    );
    expect(mermaid.render).not.toHaveBeenCalled();
  });

  /*
   * サーバーでは図に組まない。Mermaid は `document` を触るので Workers では動かず、
   * 動いたとしても読者に届く前に図を作る意味がない (ADR 0023)。
   */
  it("SSR ではソースをそのまま返し、Mermaid を呼ばない", () => {
    const html = renderToStaticMarkup(
      <MdastRenderer node={fence("mermaid", DIAGRAM)} />,
    );

    expect(html).toContain('class="mermaid-source"');
    expect(html).toContain("graph TD;");
    expect(html).not.toContain("<svg");
    expect(mermaid.render).not.toHaveBeenCalled();
  });
});
