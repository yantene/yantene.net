import { describe, expect, it } from "vitest";
import { InvalidWorkSummaryError, WorkSummary } from "./work-summary.vo";

describe("WorkSummary", () => {
  it("trims the surrounding whitespace", () => {
    expect(WorkSummary.create("  読んだものを覚えておくやつ。  ").toString()).toBe(
      "読んだものを覚えておくやつ。",
    );
  });

  it("rejects an empty summary", () => {
    expect(() => WorkSummary.create("   ")).toThrow(InvalidWorkSummaryError);
  });

  it("rejects a summary longer than 200 characters", () => {
    expect(() => WorkSummary.create("あ".repeat(201))).toThrow(InvalidWorkSummaryError);
  });

  /** 並ぶのは箇条の 1 行なので、書き手が折り返しを決める場所ではない。 */
  it("rejects a multi-line summary", () => {
    expect(() => WorkSummary.create("1 行目\n2 行目")).toThrow(InvalidWorkSummaryError);
  });
});
