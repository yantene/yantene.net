import type { Root } from "mdast";
import { describe, expect, it } from "vitest";
import { loadSlideDetailPage, loadSlides, loadSlidesPage } from "./pages.handler";
import { seedSlide } from "./test-seed";
import { Profile, ProfileName, Tagline } from "~/backend/domain/profile";
import { SlideSlug } from "~/backend/domain/slide";
import { personId } from "~/backend/handlers/json-ld";
import { D1ProfileCommandRepository } from "~/backend/infra/d1/repositories";
import { createTestD1 } from "~/backend/infra/d1/test-helper";
import { R2SlideContentCache } from "~/backend/infra/r2/r2-slide-content-cache";
import { createTestR2 } from "~/backend/infra/r2/test-helper";
import { FALLBACK_PROFILE_NAME } from "~/lib/profile-fallback";

const ORIGIN = "https://yantene.net";

const BODY: Root = {
  type: "root",
  children: [{ type: "paragraph", children: [{ type: "text", value: "語り。" }] }],
};

function envWith(d1: D1Database, bucket: R2Bucket): Env {
  return { D1: d1, R2: bucket } as unknown as Env;
}

async function seedProfile(d1: D1Database): Promise<void> {
  await new D1ProfileCommandRepository(d1).upsert(
    Profile.create({
      name: ProfileName.create("書き手"),
      tagline: Tagline.create("自己紹介。"),
      socials: [],
      sourceHash: "h1",
    }),
    [],
  );
}

/** スライドを 1 本、本文つきで置いて詳細を引く。 */
async function loadDetail(
  d1: D1Database,
  slide: Parameters<typeof seedSlide>[1] = {},
): ReturnType<typeof loadSlideDetailPage> {
  const { bucket } = createTestR2();
  await seedSlide(d1, slide);
  await new R2SlideContentCache(bucket).putMdast(SlideSlug.create("semantic-slides"), BODY);
  return loadSlideDetailPage(envWith(d1, bucket), "semantic-slides", ORIGIN);
}

describe("loadSlides", () => {
  it("returns nothing before the first sync", async () => {
    expect(await loadSlides(envWith(createTestD1(), createTestR2().bucket))).toEqual([]);
  });

  it("returns every slide, newest first", async () => {
    const d1 = createTestD1();
    await seedSlide(d1, { slug: "older", publishedOn: "2025-06-01" });
    await seedSlide(d1, { slug: "newer", publishedOn: "2026-11-14" });

    const slides = await loadSlides(envWith(d1, createTestR2().bucket));

    expect(slides.map((slide) => slide.slug)).toEqual(["newer", "older"]);
  });

  it("exposes the slide in the shape the pages read", async () => {
    const d1 = createTestD1();
    await seedSlide(d1, {
      event: { name: "yantene.rb", date: "2026-11-13", url: "https://example.com/events/1" },
    });

    expect(await loadSlides(envWith(d1, createTestR2().bucket))).toEqual([
      {
        slug: "semantic-slides",
        title: "意味だけで書くスライド",
        summary: "語りの書き出し。",
        publishedOn: "2026-11-14",
        event: { name: "yantene.rb", date: "2026-11-13", url: "https://example.com/events/1" },
        pageCount: 12,
      },
    ]);
  });

  /** 発表しなかったスライド、日付や URL を書かなかった場は null で出す。 */
  it("exposes what was not written as null", async () => {
    const d1 = createTestD1();
    await seedSlide(d1, { slug: "no-event" });
    await seedSlide(d1, { slug: "name-only", event: { name: "社内 LT" } });

    const slides = await loadSlides(envWith(d1, createTestR2().bucket));
    const bySlug = new Map(slides.map((slide) => [slide.slug, slide.event]));

    expect(bySlug.get("no-event")).toBeNull();
    expect(bySlug.get("name-only")).toEqual({ name: "社内 LT", date: null, url: null });
  });
});

describe("loadSlidesPage の JSON-LD (ADR 0048)", () => {
  it("スライドがあれば、サイトの一部である一覧として名乗る", async () => {
    const d1 = createTestD1();
    await seedSlide(d1);

    const data = await loadSlidesPage(envWith(d1, createTestR2().bucket), ORIGIN);

    expect(data.slides).toHaveLength(1);
    expect(data.jsonLd).toMatchObject({
      "@type": "CollectionPage",
      url: `${ORIGIN}/slides`,
      isPartOf: { "@id": `${ORIGIN}/#website` },
    });
  });

  /** その場所が在ることは、置き終わる前から言ってよい。 */
  it("スライドが 1 本も無くても同じ一覧として名乗る", async () => {
    const data = await loadSlidesPage(envWith(createTestD1(), createTestR2().bucket), ORIGIN);

    expect(data.slides).toEqual([]);
    expect(data.jsonLd).toMatchObject({ "@type": "CollectionPage", url: `${ORIGIN}/slides` });
  });
});

describe("loadSlideDetailPage", () => {
  it("returns the slide and its body", async () => {
    const data = await loadDetail(createTestD1());

    expect(data.slide?.title).toBe("意味だけで書くスライド");
    expect(data.slide?.pageCount).toBe(12);
    expect(data.mdast).toEqual(BODY);
    expect(data.linkCards).toEqual({});
  });

  it("names the writer from the profile for the cover", async () => {
    const d1 = createTestD1();
    await seedProfile(d1);

    expect((await loadDetail(d1)).author).toBe("書き手");
  });

  /** 同期の前でも表紙は名前を出せる。 */
  it("falls back to the default name before the profile is synced", async () => {
    expect((await loadDetail(createTestD1())).author).toBe(FALLBACK_PROFILE_NAME);
  });

  it("returns null for an unknown slug", async () => {
    const data = await loadSlideDetailPage(
      envWith(createTestD1(), createTestR2().bucket),
      "missing",
      ORIGIN,
    );

    expect(data).toEqual({
      slide: null,
      mdast: null,
      linkCards: {},
      author: FALLBACK_PROFILE_NAME,
      jsonLd: null,
    });
  });

  /** スラグとして読めない綴りは 404。読めないことを 500 に化けさせない。 */
  it("returns null for an unreadable slug", async () => {
    const data = await loadSlideDetailPage(
      envWith(createTestD1(), createTestR2().bucket),
      "Bad--Name",
      ORIGIN,
    );

    expect(data.slide).toBeNull();
    expect(data.jsonLd).toBeNull();
  });

  /*
   * D1 に在るのに R2 の MDAST が無い = キャッシュ不整合。静かに 404 で隠すと、出ている
   * スライドが消えて見える。
   */
  it("fails loudly when the body is missing from R2", async () => {
    const d1 = createTestD1();
    await seedSlide(d1);

    await expect(
      loadSlideDetailPage(envWith(d1, createTestR2().bucket), "semantic-slides", ORIGIN),
    ).rejects.toThrow("MDAST cache is missing for an indexed slide: semantic-slides");
  });
});

describe("loadSlideDetailPage: JSON-LD", () => {
  it("builds PresentationDigitalDocument JSON-LD pointing at the canonical URL", async () => {
    const { jsonLd } = await loadDetail(createTestD1());

    expect(jsonLd).toMatchObject({
      "@context": "https://schema.org",
      "@type": "PresentationDigitalDocument",
      name: "意味だけで書くスライド",
      description: "語りの書き出し。",
      url: `${ORIGIN}/slides/semantic-slides`,
      datePublished: "2026-11-14",
      isPartOf: { "@id": `${ORIGIN}/#website` },
    });
  });

  /** 空の字を置くと「説明は空だと分かっている」という主張になる。欄ごと出さない。 */
  it("omits description when the deck has no narration", async () => {
    const { jsonLd } = await loadDetail(createTestD1(), { summary: "" });

    expect(jsonLd).not.toHaveProperty("description");
  });

  /*
   * 書き手は、記事の筆者や `/about` と同じ 1 人を指す (ADR 0048)。`@id` が揃っていないと、
   * 読む側からは「同じ名前の別人が書いたもの」に見える。
   */
  it("names the author under the shared @id", async () => {
    const d1 = createTestD1();
    await seedProfile(d1);

    const { jsonLd } = await loadDetail(d1);

    expect(jsonLd?.author).toEqual({
      "@type": "Person",
      "@id": personId(ORIGIN),
      name: "書き手",
      url: `${ORIGIN}/about`,
    });
  });

  it("keeps pointing at the same @id before the profile is synced", async () => {
    const { jsonLd } = await loadDetail(createTestD1());

    expect(jsonLd?.author).toMatchObject({ "@id": personId(ORIGIN), name: FALLBACK_PROFILE_NAME });
  });

  /* 発表の場は載せない。当てはまる語彙が定まらない欄を足さない。 */
  it("keeps the event out of the structured data", async () => {
    const { jsonLd } = await loadDetail(createTestD1(), {
      event: { name: "yantene.rb", date: "2026-11-13", url: "https://example.com/events/1" },
    });

    expect(JSON.stringify(jsonLd)).not.toContain("yantene.rb");
    expect(jsonLd).not.toHaveProperty("recordedAt");
  });
});
