import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { SlideDeck } from "./slide-deck";
import { sampleSlideContext, sampleSlideLabels } from "./slide-fixture";

/*
 * サーバーが描く姿。**JavaScript が動かない読み手・クローラー・印刷に届くのはこれ。**
 */
function serverMarkup(): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={["/slides/sample"]}>
      <SlideDeck context={sampleSlideContext()} labels={sampleSlideLabels} />
    </MemoryRouter>,
  );
}

function parse(markup: string): Document {
  return new DOMParser().parseFromString(markup, "text/html");
}

describe("SlideDeck のサーバー出力", () => {
  const document = parse(serverMarkup());

  it("renders every page, not only the first", () => {
    const pages = document.querySelectorAll(".slide-page");
    expect(pages).toHaveLength(sampleSlideContext().deck.pages.length);
    expect(document.body.textContent).toContain("ご清聴ありがとうございました");
  });

  /* 再生の印は、動き出してから立てる。サーバーが立てると、動かない環境で 1 枚しか見えない。 */
  it("does not claim to be playing", () => {
    expect(document.querySelector(".slide-deck")?.hasAttribute("data-playing")).toBe(false);
  });

  /* 最初の描画は必ず 1 ページ目 (サーバーはハッシュを見られない)。 */
  it("marks the first page as current", () => {
    const frames = [...document.querySelectorAll(".slide-frame")];
    expect(frames.map((frame) => frame.classList.contains("is-current"))).toEqual([
      true,
      ...Array.from({ length: frames.length - 1 }, () => false),
    ]);
  });

  /* 見ていないページは全部出した姿で持つ。段を隠す印を付けない。 */
  it("leaves no pending block on pages other than the current one", () => {
    expect(document.querySelectorAll(".is-pending")).toHaveLength(0);
    const stepped = document.querySelector("[data-revealed]");
    expect(stepped?.getAttribute("data-revealed")).toBe("3");
  });

  /* 語り (地の文) はスライドに出さない。読み物の側にだけ出る。 */
  it("keeps the narration out of the slides", () => {
    expect(document.body.textContent).not.toContain("ブログサービスでもよかったんですが");
  });

  /*
   * 見た目は静的なクラスの段階で持つ。連続値を style 属性に流さない。
   * 数式 (MathML) だけは組んだ側が style を持つ (記事と同じ。ADR 0007 / 0013)。
   */
  it("writes no style attribute of its own", () => {
    expect(document.querySelectorAll(".slide-deck [style]:not(math, math *)")).toHaveLength(0);
  });

  /*
   * 脚注の参照はリンクにしない。同じ原文を下の読み物も描くので、スライドの側も id を
   * 出すと 1 つのページに同じ id が 2 つ並ぶ。
   */
  it("shows footnote references as plain numbers without ids", () => {
    expect(document.querySelectorAll(".slide-deck [id^='user-content-fn']")).toHaveLength(0);
    expect(document.querySelector(".slide-layout-quote sup")?.textContent).toBe("1");
  });

  it("names each page for assistive technology", () => {
    const first = document.querySelector(".slide-page");
    expect(first?.getAttribute("aria-roledescription")).toBe("slide");
    expect(first?.getAttribute("aria-label")).toBe("1 / 15");
  });
});
