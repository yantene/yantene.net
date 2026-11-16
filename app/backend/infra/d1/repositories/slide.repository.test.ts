import { Temporal } from "@js-temporal/polyfill";
import { beforeEach, describe, expect, it } from "vitest";
import { D1SlideCommandRepository } from "./slide.command-repository";
import { D1SlideQueryRepository } from "./slide.query-repository";
import type { IUnpersisted } from "~/backend/domain/shared";
import { Slide, SlideEvent, SlideSlug, SlideTitle } from "~/backend/domain/slide";
import { createTestD1 } from "~/backend/infra/d1/test-helper";

function slideOf(
  params: {
    slug?: string;
    title?: string;
    publishedOn?: string;
    event?: SlideEvent;
    summary?: string;
    pageCount?: number;
    sourceHash?: string;
  } = {},
): Slide<IUnpersisted> {
  return Slide.create({
    slug: SlideSlug.create(params.slug ?? "semantic-slides"),
    title: SlideTitle.create(params.title ?? "意味だけで書くスライド"),
    publishedOn: Temporal.PlainDate.from(params.publishedOn ?? "2026-11-14"),
    event: params.event,
    summary: params.summary ?? "語りの書き出し。",
    pageCount: params.pageCount ?? 12,
    sourceHash: params.sourceHash ?? "h1",
  });
}

let d1: D1Database;
let command: D1SlideCommandRepository;
let query: D1SlideQueryRepository;

beforeEach(() => {
  d1 = createTestD1();
  command = new D1SlideCommandRepository(d1);
  query = new D1SlideQueryRepository(d1);
});

describe("D1 slide repositories", () => {
  it("returns nothing before the first upsert", async () => {
    expect(await query.list()).toEqual([]);
    expect(await query.findBySlug(SlideSlug.create("semantic-slides"))).toBeUndefined();
    expect((await query.listSourceHashes()).size).toBe(0);
  });

  it("stores a slide and reads it back", async () => {
    await command.upsert(
      slideOf({
        event: SlideEvent.create({
          name: "yantene.rb #1",
          date: Temporal.PlainDate.from("2026-11-13"),
          url: "https://example.com/events/1",
        }),
      }),
    );

    const slide = await query.findBySlug(SlideSlug.create("semantic-slides"));
    expect(slide?.id).toBeTypeOf("string");
    expect(slide?.title.toString()).toBe("意味だけで書くスライド");
    expect(slide?.publishedOn.toString()).toBe("2026-11-14");
    expect(slide?.event?.toJSON()).toEqual({
      name: "yantene.rb #1",
      date: "2026-11-13",
      url: "https://example.com/events/1",
    });
    expect(slide?.summary).toBe("語りの書き出し。");
    expect(slide?.pageCount).toBe(12);
    expect(slide?.sourceHash).toBe("h1");
  });

  /** 発表しなかったスライド。場の 3 列はすべて NULL で、読み戻すと undefined。 */
  it("reads a slide without an event back as undefined", async () => {
    await command.upsert(slideOf());

    expect((await query.findBySlug(SlideSlug.create("semantic-slides")))?.event).toBeUndefined();
  });

  it("keeps an event that has only a name", async () => {
    await command.upsert(slideOf({ event: SlideEvent.create({ name: "社内 LT" }) }));

    const [slide] = await query.list();
    expect(slide?.event?.toJSON()).toEqual({ name: "社内 LT", date: null, url: null });
  });

  /** 語りを書いていないスライドの要約は空。空のまま往復すること。 */
  it("stores an empty summary", async () => {
    await command.upsert(slideOf({ summary: "" }));

    expect((await query.list())[0]?.summary).toBe("");
  });

  it("updates in place and keeps the id on a second upsert", async () => {
    await command.upsert(
      slideOf({ event: SlideEvent.create({ name: "yantene.rb #1" }), sourceHash: "h1" }),
    );
    const before = await query.findBySlug(SlideSlug.create("semantic-slides"));

    await command.upsert(slideOf({ title: "改めた題", pageCount: 20, sourceHash: "h2" }));
    const after = await query.findBySlug(SlideSlug.create("semantic-slides"));

    expect(await query.list()).toHaveLength(1);
    expect(after?.id).toBe(before?.id);
    expect(after?.title.toString()).toBe("改めた題");
    expect(after?.pageCount).toBe(20);
    expect(after?.sourceHash).toBe("h2");
    // 場を消したら、前の場が残らないこと。
    expect(after?.event).toBeUndefined();
  });

  it("lists by published date, newest first, then by slug", async () => {
    await command.upsert(slideOf({ slug: "old", publishedOn: "2025-01-01" }));
    await command.upsert(slideOf({ slug: "b-same-day", publishedOn: "2026-11-14" }));
    await command.upsert(slideOf({ slug: "a-same-day", publishedOn: "2026-11-14" }));
    await command.upsert(slideOf({ slug: "newest", publishedOn: "2026-12-01" }));

    expect((await query.list()).map((slide) => slide.slug.toString())).toEqual([
      "newest",
      "a-same-day",
      "b-same-day",
      "old",
    ]);
  });

  it("lists the source hashes by slug", async () => {
    await command.upsert(slideOf({ slug: "a", sourceHash: "ha" }));
    await command.upsert(slideOf({ slug: "b", sourceHash: "hb" }));

    expect(await query.listSourceHashes()).toEqual(
      new Map([
        ["a", "ha"],
        ["b", "hb"],
      ]),
    );
  });

  it("deletes by slug and leaves the others", async () => {
    await command.upsert(slideOf({ slug: "a" }));
    await command.upsert(slideOf({ slug: "b" }));

    await command.deleteBySlug(SlideSlug.create("a"));

    expect((await query.list()).map((slide) => slide.slug.toString())).toEqual(["b"]);
  });

  it("does nothing when deleting a slug that is not stored", async () => {
    await expect(command.deleteBySlug(SlideSlug.create("missing"))).resolves.toBeUndefined();
  });
});
