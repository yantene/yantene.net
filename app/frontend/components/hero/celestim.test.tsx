import fs from "node:fs";
import path from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Celestim } from "./celestim";

const css = fs.readFileSync(
  path.join(import.meta.dirname, "celestim.css"),
  "utf8",
);

type Rgba = {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly alpha: number;
};

type ColorStop = {
  readonly offset: number;
  readonly color: Rgba;
};

/** `@keyframes <name>` の中身だけを切り出す (prettier 整形前提で閉じ括弧は行頭)。 */
function keyframesBlock(name: string): string {
  const start = css.indexOf(`@keyframes ${name} {`);
  expect(start, `@keyframes ${name} not found`).toBeGreaterThanOrEqual(0);

  const end = css.indexOf("\n}", start);
  expect(end, `@keyframes ${name} is not terminated`).toBeGreaterThan(start);

  return css.slice(start, end);
}

function parseColor(text: string): Rgba {
  // rgb(255 255 255 / 50%) と rgb(201 242 255) の両方を 4 要素に正規化する。
  const withAlpha = text.includes("/") ? text : `${text} / 100%`;
  const [red, green, blue, alphaPercent] = withAlpha
    .split(/[\s%/]+/)
    .filter(Boolean)
    .map(Number);

  return { red, green, blue, alpha: alphaPercent / 100 };
}

/** キーフレームの `<n>% { background-color: ... }` を offset 昇順で拾う。 */
function parseStops(name: string): readonly ColorStop[] {
  // `}` で割ると 1 チャンク = 1 ストップになる。offset は直前の `{` の行に、
  // 色は rgb(...) に入っている。
  const stops = keyframesBlock(name)
    .split("}")
    .flatMap((chunk) => {
      const offsetLine = chunk.split("{").at(-2)?.split("\n").at(-1)?.trim();
      const color = /rgb\(([^)]+)\)/.exec(chunk);
      if (offsetLine?.endsWith("%") !== true || !color) return [];

      const [, colorText] = color;
      return [
        {
          offset: Number(offsetLine.slice(0, -1)) / 100,
          color: parseColor(colorText),
        },
      ];
    });

  expect(
    stops.length,
    `no stops parsed from @keyframes ${name}`,
  ).toBeGreaterThan(1);

  return stops.toSorted((a, b) => a.offset - b.offset);
}

/** キーフレーム間は sRGB 線形補間される (CSS の既定)。 */
function sampleAt(stops: readonly ColorStop[], offset: number): Rgba {
  const before = stops.findLast((stop) => stop.offset <= offset);
  const after = stops.find((stop) => stop.offset >= offset);
  if (!before || !after)
    throw new Error(`offset ${String(offset)} is uncovered`);

  const span = after.offset - before.offset;
  const progress = span === 0 ? 0 : (offset - before.offset) / span;
  const mix = (from: number, to: number): number =>
    from + (to - from) * progress;

  return {
    red: mix(before.color.red, after.color.red),
    green: mix(before.color.green, after.color.green),
    blue: mix(before.color.blue, after.color.blue),
    alpha: mix(before.color.alpha, after.color.alpha),
  };
}

function toLinear(channel: number): number {
  const ratio = channel / 255;
  return ratio <= 0.04045 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
}

function luminance({ red, green, blue }: Rgba): number {
  return (
    0.2126 * toLinear(red) + 0.7152 * toLinear(green) + 0.0722 * toLinear(blue)
  );
}

/** over 演算 (source-over)。結果は不透明。 */
function composite(over: Rgba, under: Rgba): Rgba {
  const mix = (top: number, bottom: number): number =>
    over.alpha * top + (1 - over.alpha) * bottom;

  return {
    red: mix(over.red, under.red),
    green: mix(over.green, under.green),
    blue: mix(over.blue, under.blue),
    alpha: 1,
  };
}

function contrastRatio(a: Rgba, b: Rgba): number {
  const [high, low] = [luminance(a), luminance(b)].toSorted((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

describe("Celestim", () => {
  it("omits the readability veil unless it is asked for", () => {
    const { container } = render(<Celestim />);

    expect(container.querySelector(".celestim-veil")).toBeNull();
  });

  it("layers the veil between the moon and the sun", () => {
    const { container } = render(<Celestim veil />);
    const sky = container.querySelector(".celestim-sky");
    const order = [...(sky?.children ?? [])].map(
      (element) => element.className,
    );
    const indexOf = (needle: string): number =>
      order.findIndex((name) => name.includes(needle));

    // 月の影は空と同色で描かれるのでヴェールより奥、
    // 太陽は白いヴェールに溶けないよう手前でなければならない。
    expect(indexOf("celestim-lunar-turntable")).toBeLessThan(
      indexOf("celestim-veil"),
    );
    expect(indexOf("celestim-veil")).toBeLessThan(
      indexOf("celestim-solar-turntable"),
    );
  });

  it("keeps veiled-sky text above WCAG AA across the whole day cycle", () => {
    const sky = parseStops("sky-color-cycle");
    const veil = parseStops("celestim-veil-cycle");
    // ヒーローが実際に使う副次テキスト色 (base-content #1a2740 を 80% で重ねる)。
    const bodyText: Rgba = { red: 26, green: 39, blue: 64, alpha: 0.8 };

    const ratios = Array.from({ length: 201 }, (_, step) => {
      const offset = step / 200;
      const surface = composite(sampleAt(veil, offset), sampleAt(sky, offset));
      return contrastRatio(composite(bodyText, surface), surface);
    });

    expect(Math.min(...ratios)).toBeGreaterThanOrEqual(4.5);
  });
});
