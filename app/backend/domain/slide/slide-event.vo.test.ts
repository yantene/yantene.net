import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import { InvalidSlideEventError, SlideEvent } from "./slide-event.vo";

describe("SlideEvent", () => {
  it("keeps the name alone when nothing else is written", () => {
    const event = SlideEvent.create({ name: "  yantene.rb #1  " });

    expect(event.name).toBe("yantene.rb #1");
    expect(event.date).toBeUndefined();
    expect(event.url).toBeUndefined();
    expect(event.toJSON()).toEqual({ name: "yantene.rb #1", date: null, url: null });
  });

  it("carries the date and the url", () => {
    const event = SlideEvent.create({
      name: "yantene.rb #1",
      date: Temporal.PlainDate.from("2026-11-14"),
      url: "https://example.com/events/1",
    });

    expect(event.toJSON()).toEqual({
      name: "yantene.rb #1",
      date: "2026-11-14",
      url: "https://example.com/events/1",
    });
  });

  it.each([
    ["空", ""],
    ["空白だけ", "  "],
    ["201 文字", "あ".repeat(201)],
  ])("名前が%sなら弾く", (_label, name) => {
    expect(() => SlideEvent.create({ name })).toThrow(InvalidSlideEventError);
  });

  /* `javascript:` や相対パスが、そのまま href に乗る経路を作らない。 */
  it.each([
    ["相対パス", "/events/1"],
    ["javascript:", "javascript:alert(1)"],
    ["空", ""],
  ])("URL が%sなら弾く", (_label, url) => {
    expect(() => SlideEvent.create({ name: "x", url })).toThrow(InvalidSlideEventError);
  });

  it("equals compares every part", () => {
    const base = {
      name: "x",
      date: Temporal.PlainDate.from("2026-11-14"),
      url: "https://example.com/",
    };

    expect(SlideEvent.create(base).equals(SlideEvent.create(base))).toBe(true);
    expect(SlideEvent.create(base).equals(SlideEvent.create({ ...base, name: "y" }))).toBe(false);
    expect(SlideEvent.create(base).equals(SlideEvent.create({ name: "x", url: base.url }))).toBe(
      false,
    );
    expect(SlideEvent.create(base).equals(SlideEvent.create({ name: "x", date: base.date }))).toBe(
      false,
    );
  });
});
