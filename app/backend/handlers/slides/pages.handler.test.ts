import type { Root } from "mdast";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadSlideDetailPage, loadSlides, loadSlidesPage } from "./pages.handler";
import { seedSlide } from "./test-seed";
import { Profile, ProfileName, Tagline } from "~/backend/domain/profile";
import { contentStatuses } from "~/backend/domain/shared";
import { SlideSlug } from "~/backend/domain/slide";
import * as currentAccountModule from "~/backend/handlers/auth/current-account";
import { personId } from "~/backend/handlers/json-ld";
import { D1ProfileCommandRepository } from "~/backend/infra/d1/repositories";
import { createTestD1 } from "~/backend/infra/d1/test-helper";
import { R2SlideContentCache } from "~/backend/infra/r2/r2-slide-content-cache";
import { createTestR2 } from "~/backend/infra/r2/test-helper";
import { FALLBACK_PROFILE_NAME } from "~/lib/profile-fallback";

const ORIGIN = "https://yantene.net";

/** cookie を持たない読み手の要求。 */
function readerRequest(): Request {
  return new Request(`${ORIGIN}/slides/semantic-slides`);
}

/** ログインしている管理者として振る舞わせる。 */
function asAdmin(): void {
  vi.spyOn(currentAccountModule, "currentAccount").mockResolvedValue({
    email: { toString: () => "admin@example.test" } as never,
    admin: true,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

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
  return loadSlideDetailPage(envWith(d1, bucket), readerRequest(), "semantic-slides", ORIGIN);
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
      readerRequest(),
      "missing",
      ORIGIN,
    );

    expect(data).toEqual({
      slide: null,
      mdast: null,
      linkCards: {},
      author: FALLBACK_PROFILE_NAME,
      jsonLd: null,
      noindex: false,
      privateResponse: false,
    });
  });

  /** スラグとして読めない綴りは 404。読めないことを 500 に化けさせない。 */
  it("returns null for an unreadable slug", async () => {
    const data = await loadSlideDetailPage(
      envWith(createTestD1(), createTestR2().bucket),
      readerRequest(),
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
      loadSlideDetailPage(
        envWith(d1, createTestR2().bucket),
        readerRequest(),
        "semantic-slides",
        ORIGIN,
      ),
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

/*
 * 公開範囲 (ADR 0040)。記事と同じ表になること。
 */
describe("status ごとの一覧 (loadSlides)", () => {
  async function seedEvery(d1: D1Database): Promise<void> {
    for (const status of contentStatuses) {
      await seedSlide(d1, { slug: `a-${status}`, status });
    }
  }

  it("published だけを返す", async () => {
    const d1 = createTestD1();
    await seedEvery(d1);

    const slides = await loadSlides(envWith(d1, createTestR2().bucket));

    expect(slides.map((slide) => slide.slug)).toEqual(["a-published"]);
  });

  /* 一覧は env しか受け取らない。誰が見ていても同じものが返る作りになっている。 */
  it("管理者がログインしていても published だけを返す", async () => {
    const d1 = createTestD1();
    await seedEvery(d1);
    asAdmin();

    const slides = await loadSlides(envWith(d1, createTestR2().bucket));

    expect(slides.map((slide) => slide.slug)).toEqual(["a-published"]);
  });

  /* status は読み手に配る形に載せない。 */
  it("配る形に status を載せない", async () => {
    const d1 = createTestD1();
    await seedSlide(d1);

    const [slide] = await loadSlides(envWith(d1, createTestR2().bucket));

    expect(slide).not.toHaveProperty("status");
  });
});

describe("status ごとのスライドのページ (loadSlideDetailPage)", () => {
  it.each(["withdrawn", "draft", "idea"] as const)("%s は読み手には無い", async (status) => {
    const data = await loadDetail(createTestD1(), { status });

    expect(data.slide).toBeNull();
    expect(data.mdast).toBeNull();
    expect(data.jsonLd).toBeNull();
    expect(data.privateResponse).toBe(false);
  });

  it("unlisted は読み手も読めて、noindex を伝える", async () => {
    const data = await loadDetail(createTestD1(), { status: "unlisted" });

    expect(data.slide?.slug).toBe("semantic-slides");
    expect(data.noindex).toBe(true);
    expect(data.privateResponse).toBe(false);
  });

  it("published に noindex は立てない", async () => {
    const data = await loadDetail(createTestD1(), { status: "published" });

    expect(data.noindex).toBe(false);
    expect(data.privateResponse).toBe(false);
  });

  /* 管理者は下書きを読めるが、その応答は共有キャッシュに載ってはいけない。 */
  it.each(["withdrawn", "draft", "idea"] as const)(
    "管理者は %s を読めて、応答を共有キャッシュから遠ざける",
    async (status) => {
      asAdmin();

      const data = await loadDetail(createTestD1(), { status });

      expect(data.slide?.slug).toBe("semantic-slides");
      expect(data.privateResponse).toBe(true);
      // 見えているのは本人だけ。クローラーは辿り着けないので noindex は立てない。
      expect(data.noindex).toBe(false);
    },
  );

  /* 読み手も辿り着けるものは中身が同じなので、管理者が見ていても遠ざけない。 */
  it.each(["published", "unlisted"] as const)(
    "管理者が %s を読んでも遠ざけない",
    async (status) => {
      asAdmin();

      const data = await loadDetail(createTestD1(), { status });

      expect(data.slide?.slug).toBe("semantic-slides");
      expect(data.privateResponse).toBe(false);
    },
  );

  it("ログインしていても管理者でなければ draft は無い", async () => {
    vi.spyOn(currentAccountModule, "currentAccount").mockResolvedValue({
      email: { toString: () => "reader@example.test" } as never,
      admin: false,
    });

    const data = await loadDetail(createTestD1(), { status: "draft" });

    expect(data.slide).toBeNull();
  });
});
