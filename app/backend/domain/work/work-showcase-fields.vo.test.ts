import { describe, expect, it } from "vitest";
import { InvalidWorkPeriodError, WorkPeriod } from "./work-period.vo";
import { InvalidWorkRoleError, WorkRole } from "./work-role.vo";
import {
  InvalidWorkScreenshotError,
  isWorkScreenshotKind,
  WorkScreenshot,
} from "./work-screenshot.vo";
import { InvalidWorkStackError, WorkStack } from "./work-stack.vo";
import { HistoryDate } from "~/backend/domain/profile";

describe("WorkRole", () => {
  it("trims the value", () => {
    expect(WorkRole.create("  設計から運用まで  ").toString()).toBe("設計から運用まで");
  });

  it.each([
    ["空", "   "],
    ["2 行", "設計\n運用"],
    ["長すぎる", "あ".repeat(201)],
  ])("rejects a role that is %s", (_label, raw) => {
    expect(() => WorkRole.create(raw)).toThrow(InvalidWorkRoleError);
  });

  it("compares by value", () => {
    expect(WorkRole.create("設計").equals(WorkRole.create("設計"))).toBe(true);
    expect(WorkRole.create("設計").equals(WorkRole.create("運用"))).toBe(false);
  });
});

describe("WorkStack", () => {
  it("keeps the written order", () => {
    expect(WorkStack.create(["TypeScript", " Hono "]).toArray()).toEqual(["TypeScript", "Hono"]);
  });

  it("is empty when nothing is written", () => {
    expect(WorkStack.empty().toArray()).toEqual([]);
    expect(WorkStack.empty().equals(WorkStack.create([]))).toBe(true);
  });

  it.each([
    ["空の名前", ["TypeScript", " "]],
    ["改行のある名前", ["Type\nScript"]],
    ["長すぎる名前", ["あ".repeat(41)]],
    ["同じ名前が 2 つ", ["Hono", "Hono"]],
    ["多すぎる", Array.from({ length: 21 }, (_unused, index) => `tech-${String(index)}`)],
  ])("rejects %s", (_label, raw) => {
    expect(() => WorkStack.create(raw)).toThrow(InvalidWorkStackError);
  });

  it("compares in order", () => {
    expect(WorkStack.create(["a", "b"]).equals(WorkStack.create(["a", "b"]))).toBe(true);
    expect(WorkStack.create(["a", "b"]).equals(WorkStack.create(["b", "a"]))).toBe(false);
  });
});

describe("WorkPeriod", () => {
  const date = (raw: string | number): HistoryDate => HistoryDate.create(raw);

  it("holds a start without an end", () => {
    const period = WorkPeriod.create({ from: date(2024) });
    expect(period.toJSON()).toEqual({ from: "2024", until: undefined });
  });

  it("holds a span", () => {
    const period = WorkPeriod.create({ from: date("2024-06"), until: date("2025-03") });
    expect(period.toJSON()).toEqual({ from: "2024-06", until: "2025-03" });
  });

  /** 経歴の `until` と同じ決まり (同じ精度で、始まりより後)。 */
  it.each([
    ["精度が違う", "2024", "2025-03"],
    ["始まりより前", "2025-03", "2024-06"],
    ["始まりと同じ", "2024-06-04", "2024-06-04"],
  ])("rejects an end that is %s", (_label, from, until) => {
    expect(() => WorkPeriod.create({ from: date(from), until: date(until) })).toThrow(
      InvalidWorkPeriodError,
    );
  });

  it("compares by value", () => {
    const span = WorkPeriod.create({ from: date(2024), until: date(2025) });
    expect(span.equals(WorkPeriod.create({ from: date(2024), until: date(2025) }))).toBe(true);
    expect(span.equals(WorkPeriod.create({ from: date(2024) }))).toBe(false);
  });
});

describe("WorkScreenshot", () => {
  it("defaults kind to desktop and carries no dimensions", () => {
    const screenshot = WorkScreenshot.create({ src: "./top.png", alt: " トップ画面 " });
    expect(screenshot.toJSON()).toEqual({
      src: "./top.png",
      alt: "トップ画面",
      kind: "desktop",
      width: undefined,
      height: undefined,
    });
  });

  /** 置き場と寸法を添えても、alt と kind は書き手が書いたまま。元の値は変わらない。 */
  it("returns a located copy without changing the original", () => {
    const written = WorkScreenshot.create({ src: "./top.png", alt: "トップ画面", kind: "mobile" });
    const located = written.locatedAt({
      src: "/api/v1/works/x/assets/top.png",
      dimensions: { width: 450, height: 950 },
    });

    expect(located.toJSON()).toEqual({
      src: "/api/v1/works/x/assets/top.png",
      alt: "トップ画面",
      kind: "mobile",
      width: 450,
      height: 950,
    });
    expect(written.src).toBe("./top.png");
    expect(written.dimensions).toBeUndefined();
  });

  it.each([
    ["src が空", { src: " ", alt: "画面" }],
    ["alt が空", { src: "./top.png", alt: " " }],
    ["alt が長すぎる", { src: "./top.png", alt: "あ".repeat(301) }],
    ["寸法が 0", { src: "./top.png", alt: "画面", dimensions: { width: 0, height: 900 } }],
    ["寸法が小数", { src: "./top.png", alt: "画面", dimensions: { width: 1.5, height: 900 } }],
  ])("rejects a screenshot whose %s", (_label, params) => {
    expect(() => WorkScreenshot.create(params)).toThrow(InvalidWorkScreenshotError);
  });

  it("knows the kinds a frame exists for", () => {
    expect(isWorkScreenshotKind("desktop")).toBe(true);
    expect(isWorkScreenshotKind("mobile")).toBe(true);
    expect(isWorkScreenshotKind("tablet")).toBe(false);
    expect(isWorkScreenshotKind(undefined)).toBe(false);
  });

  it("compares by value", () => {
    const a = WorkScreenshot.create({ src: "./top.png", alt: "画面" });
    expect(a.equals(WorkScreenshot.create({ src: "./top.png", alt: "画面" }))).toBe(true);
    expect(a.equals(WorkScreenshot.create({ src: "./top.png", alt: "画面", kind: "mobile" }))).toBe(
      false,
    );
  });
});
