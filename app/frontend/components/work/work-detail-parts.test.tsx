import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkFacts } from "./work-facts";
import { sampleScreenshots } from "./work-fixture";
import { WorkGallery } from "./work-gallery";

describe("WorkGallery", () => {
  function renderGallery(screenshots = sampleScreenshots): HTMLElement {
    return render(<WorkGallery screenshots={screenshots} label="スクリーンショット" />).container;
  }

  /** 1 枚も無い作品では空の器を残さない。 */
  it("renders nothing without screenshots", () => {
    expect(renderGallery([]).innerHTML).toBe("");
  });

  /*
   * 枠の比率は kind ごとの静的なクラスで決める。**`style` 属性で流さない** (inline style を
   * 書かない決まり。CSP は止めないので、ここで形として止める)。
   */
  it("picks the frame by kind with a static class, never an inline style", () => {
    const container = renderGallery();
    const frames = [...container.querySelectorAll("li")].map((frame) => frame.className);

    expect(frames).toEqual([
      "work-gallery-frame work-gallery-desktop",
      "work-gallery-frame work-gallery-mobile",
      "work-gallery-frame work-gallery-desktop",
    ]);
    expect(container.querySelectorAll("[style]")).toHaveLength(0);
  });

  /** 読み込みの前後でページを動かさないために、読めた寸法を `<img>` に添える。 */
  it("carries the alt and the dimensions on each image", () => {
    const [first] = renderGallery().querySelectorAll("img");

    expect(first?.getAttribute("alt")).toBe("新着記事が要約つきで並ぶトップ画面");
    expect(first?.getAttribute("width")).toBe("1600");
    expect(first?.getAttribute("height")).toBe("900");
  });

  /** 寸法を読めなかった画像には、誤った寸法も 0 も付けない。 */
  it("leaves width and height off an image whose dimensions are unknown", () => {
    const [first] = renderGallery([
      { src: "/a.png", alt: "画面", kind: "desktop", width: null, height: null },
    ]).querySelectorAll("img");

    expect(first?.hasAttribute("width")).toBe(false);
    expect(first?.hasAttribute("height")).toBe(false);
  });

  /** 拡大は記事の画像と同じ器。押し場所の名前に alt が入る (#304)。 */
  it("opens each screenshot through the shared lightbox trigger", () => {
    const triggers = renderGallery().querySelectorAll("button.lightbox-trigger");

    expect(triggers).toHaveLength(3);
    expect(triggers[1]?.getAttribute("aria-label")).toContain("スマートフォンで記事を開いた画面");
  });

  /** 頭の 1 枚だけ先に読む。残りは横に送るまで見えない。 */
  it("loads only the first screenshot eagerly", () => {
    const loading = [...renderGallery().querySelectorAll("img")].map((image) =>
      image.getAttribute("loading"),
    );
    expect(loading).toEqual(["eager", "lazy", "lazy"]);
  });
});

describe("WorkFacts", () => {
  const full = {
    stack: ["TypeScript", "Hono"],
    period: { from: "2024-06", until: "2024-09" },
    role: "設計から運用まで",
  };

  function rowNames(container: HTMLElement): (string | null)[] {
    return [...container.querySelectorAll("dt")].map((name) => name.textContent);
  }

  /** どの欄も書いていない作品 (既存の作品はすべてこれ) では何も描かない。 */
  it("renders nothing when every field is empty", () => {
    const { container } = render(<WorkFacts work={{ stack: [], period: null, role: null }} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders the stack as tags in the written order", () => {
    const { container } = render(<WorkFacts work={full} />);
    const tags = [...container.querySelectorAll(".work-facts-tag")].map((tag) => tag.textContent);
    expect(tags).toEqual(["TypeScript", "Hono"]);
  });

  /** 札は経歴の年表と同じ畳み方 (始まりと重なる位を落とす)。 */
  it("folds the period the same way the history does", () => {
    const { container } = render(<WorkFacts work={full} />);
    expect(container.querySelector(".work-facts-period")?.textContent).toBe("2024-06 〜 09");
  });

  it("shows only the start for a period without an end", () => {
    const { container } = render(
      <WorkFacts work={{ ...full, period: { from: "2024", until: null } }} />,
    );
    expect(container.querySelector(".work-facts-period")?.textContent).toBe("2024");
  });

  /** 欄が空いていても崩れない。書いた欄の行だけが出る。 */
  it.each([
    ["stack だけ", { stack: ["Ruby"], period: null, role: null }, 1],
    ["period だけ", { stack: [], period: { from: "2024", until: null }, role: null }, 1],
    ["role だけ", { stack: [], period: null, role: "設計" }, 1],
    ["全部", full, 3],
  ])("renders a row only for the fields written: %s", (_label, work, rows) => {
    const { container } = render(<WorkFacts work={work} />);
    expect(rowNames(container)).toHaveLength(rows);
  });

  /** 時期は機械に名乗る日時ではない (精度が 3 段あり、終わりも持つ)。 */
  it("does not mark the period up as a time element", () => {
    const { container } = render(<WorkFacts work={full} />);
    expect(container.querySelector("time")).toBeNull();
  });
});
