import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import { instant, plainDate } from "./temporal.custom-type";

describe("instant custom type", () => {
  it("should be defined as a custom type builder function", () => {
    expect(instant).toBeDefined();
    expect(typeof instant).toBe("function");
  });
});

describe("plainDate custom type", () => {
  it("should be defined as a custom type builder function", () => {
    expect(plainDate).toBeDefined();
    expect(typeof plainDate).toBe("function");
  });

  it("should create a column when called with a column name", () => {
    const column = plainDate("test_col");
    expect(column).toBeDefined();
  });

  it("should support Temporal.PlainDate toString for ISO 8601 date format", () => {
    const date = Temporal.PlainDate.from("2026-02-17");
    expect(date.toString()).toBe("2026-02-17");
  });

  it("should support Temporal.PlainDate.from for parsing ISO 8601 date string", () => {
    const parsed = Temporal.PlainDate.from("2026-02-17");
    expect(parsed.year).toBe(2026);
    expect(parsed.month).toBe(2);
    expect(parsed.day).toBe(17);
  });
});
