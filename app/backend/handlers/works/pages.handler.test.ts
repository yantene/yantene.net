import type { Root } from "mdast";
import { describe, expect, it } from "vitest";
import { loadWorkDetailPage, loadWorks, loadWorksPage } from "./pages.handler";
import type { ArticleStatus } from "~/backend/domain/article";
import { Temporal } from "@js-temporal/polyfill";
import { Article, ArticleSlug, ArticleTitle } from "~/backend/domain/article";
import { Profile, ProfileName, Tagline } from "~/backend/domain/profile";
import {
  Work,
  WorkName,
  WorkScreenshot,
  WorkSlug,
  WorkSummary,
  WorkUrl,
} from "~/backend/domain/work";
import { personId } from "~/backend/handlers/json-ld";
import {
  D1ArticleCommandRepository,
  D1ProfileCommandRepository,
  D1WorkCommandRepository,
} from "~/backend/infra/d1/repositories";
import { FALLBACK_PROFILE_NAME } from "~/lib/profile-fallback";
import { createTestD1 } from "~/backend/infra/d1/test-helper";
import { R2WorkContentCache } from "~/backend/infra/r2/r2-work-content-cache";
import { createTestR2 } from "~/backend/infra/r2/test-helper";

const ORIGIN = "https://yantene.net";

const BODY: Root = {
  type: "root",
  children: [{ type: "paragraph", children: [{ type: "text", value: "詳しい説明。" }] }],
};

function envWith(d1: D1Database, bucket: R2Bucket): Env {
  return { D1: d1, R2: bucket } as unknown as Env;
}

async function seedWork(
  d1: D1Database,
  params: {
    slug?: string;
    name?: string;
    url?: string;
    position?: number;
    screenshots?: readonly WorkScreenshot[];
    articleSlugs?: readonly string[];
  } = {},
): Promise<void> {
  await new D1WorkCommandRepository(d1).upsert(
    Work.create({
      slug: WorkSlug.create(params.slug ?? "infoholick"),
      name: WorkName.create(params.name ?? "infoholick"),
      summary: WorkSummary.create("読んだものを覚えておくやつ。"),
      url: params.url === undefined ? undefined : WorkUrl.create(params.url),
      position: params.position ?? 0,
      screenshots: params.screenshots ?? [],
      articleSlugs: (params.articleSlugs ?? []).map((slug) => ArticleSlug.create(slug)),
      sourceHash: "h1",
    }),
  );
}

async function seedArticle(d1: D1Database, slug: string, status: ArticleStatus): Promise<void> {
  await new D1ArticleCommandRepository(d1).upsert(
    Article.create({
      slug: ArticleSlug.create(slug),
      title: ArticleTitle.create(`題 ${slug}`),
      summary: "要約。",
      publishedOn: Temporal.PlainDate.from("2026-01-15"),
      lastModifiedOn: Temporal.PlainDate.from("2026-01-16"),
      status,
      sourceHash: "h1",
    }),
  );
}

/** 作品を 1 件、本文つきで置いて詳細を引く。 */
async function loadDetail(
  d1: D1Database,
  work: Parameters<typeof seedWork>[1],
): ReturnType<typeof loadWorkDetailPage> {
  const { bucket } = createTestR2();
  await seedWork(d1, work);
  await new R2WorkContentCache(bucket).putMdast(WorkSlug.create("infoholick"), BODY);
  return loadWorkDetailPage(envWith(d1, bucket), "infoholick", ORIGIN);
}

describe("loadWorks", () => {
  it("returns nothing before the first sync", async () => {
    expect(await loadWorks(envWith(createTestD1(), createTestR2().bucket))).toEqual([]);
  });

  /** 切らずに全件返す。作品は書き手が手で選んで置くもの (ADR 0042)。 */
  it("returns every work in the written order", async () => {
    const d1 = createTestD1();
    await seedWork(d1, { slug: "arerd", position: 2 });
    await seedWork(d1, { slug: "infoholick", position: 0 });
    await seedWork(d1, { slug: "openapi-sorbet-rails", position: 1 });

    const works = await loadWorks(envWith(d1, createTestR2().bucket));
    expect(works.map((work) => work.slug)).toEqual(["infoholick", "openapi-sorbet-rails", "arerd"]);
  });

  it("exposes a missing url as null", async () => {
    const d1 = createTestD1();
    await seedWork(d1);
    expect((await loadWorks(envWith(d1, createTestR2().bucket)))[0]?.url).toBeNull();
  });
});

describe("loadWorksPage", () => {
  it("wraps the list", async () => {
    const d1 = createTestD1();
    await seedWork(d1, { url: "https://github.com/yantene/infoholick" });

    const { works } = await loadWorksPage(envWith(d1, createTestR2().bucket), ORIGIN);
    expect(works).toEqual([
      {
        slug: "infoholick",
        name: "infoholick",
        summary: "読んだものを覚えておくやつ。",
        url: "https://github.com/yantene/infoholick",
        stack: [],
        period: null,
        role: null,
        featured: false,
        screenshots: [],
        language: "ja",
      },
    ]);
  });

  /*
   * ⚠️ 関連記事の slug を一覧の応答に載せないこと。下書きの slug も入っているので、
   * slug だけでも書きかけの記事が在ることが漏れる。
   */
  it("never exposes the article slugs of a work", async () => {
    const d1 = createTestD1();
    await seedArticle(d1, "secret-draft", "draft");
    await seedWork(d1, { articleSlugs: ["secret-draft"] });

    const data = await loadWorksPage(envWith(d1, createTestR2().bucket), ORIGIN);
    expect(JSON.stringify(data)).not.toContain("secret-draft");
  });
});

describe("loadWorkDetailPage: この作品について書いた記事", () => {
  it("returns the published articles in the order the writer chose", async () => {
    const d1 = createTestD1();
    await seedArticle(d1, "alpha", "published");
    await seedArticle(d1, "zulu", "published");

    const data = await loadDetail(d1, { articleSlugs: ["zulu", "alpha"] });
    expect(data.articles.map((article) => article.slug)).toEqual(["zulu", "alpha"]);
  });

  /*
   * 読み手に見えない記事は黙って外す。**限定公開 (`unlisted`) も外す** — URL を知っていれば
   * 読める記事だが、ここは記事を並べる経路で、並べた時点で「一覧に出ない」が破れる。
   * まだ無い記事の slug も同じ扱い。
   */
  it.each(["unlisted", "withdrawn", "draft", "idea"] as const)(
    "leaves out an article that is %s",
    async (status) => {
      const d1 = createTestD1();
      await seedArticle(d1, "shown", "published");
      await seedArticle(d1, "hidden", status);

      const data = await loadDetail(d1, { articleSlugs: ["hidden", "shown", "not-yet-written"] });
      expect(data.articles.map((article) => article.slug)).toEqual(["shown"]);
      // 応答のどこにも (JSON-LD にも) slug が残らないこと。
      expect(JSON.stringify(data)).not.toContain("hidden");
      expect(JSON.stringify(data)).not.toContain("not-yet-written");
    },
  );

  it("returns no articles for a work that lists none", async () => {
    const data = await loadDetail(createTestD1(), {});
    expect(data.articles).toEqual([]);
  });
});

describe("loadWorkDetailPage: JSON-LD", () => {
  it("lists the screenshots as absolute image URLs", async () => {
    const data = await loadDetail(createTestD1(), {
      screenshots: [
        WorkScreenshot.create({ src: "/api/v1/works/infoholick/assets/top.png", alt: "トップ" }),
        WorkScreenshot.create({ src: "/api/v1/works/infoholick/assets/b.png", alt: "記事" }),
      ],
    });

    expect(data.jsonLd).toMatchObject({
      image: [
        `${ORIGIN}/api/v1/works/infoholick/assets/top.png`,
        `${ORIGIN}/api/v1/works/infoholick/assets/b.png`,
      ],
    });
  });

  it("points subjectOf at the articles readers can see", async () => {
    const d1 = createTestD1();
    await seedArticle(d1, "why-i-built-it", "published");
    await seedArticle(d1, "half-written", "draft");

    const data = await loadDetail(d1, { articleSlugs: ["why-i-built-it", "half-written"] });
    expect(data.jsonLd).toMatchObject({
      subjectOf: [
        {
          "@type": "BlogPosting",
          headline: "題 why-i-built-it",
          url: `${ORIGIN}/articles/why-i-built-it`,
        },
      ],
    });
  });

  /** 無いものは欄ごと出さない (空の配列を置かない)。 */
  it("omits image and subjectOf when the work has neither", async () => {
    const data = await loadDetail(createTestD1(), {});
    expect(data.jsonLd).not.toHaveProperty("image");
    expect(data.jsonLd).not.toHaveProperty("subjectOf");
  });

  it("omits subjectOf when no listed article is visible to readers", async () => {
    const d1 = createTestD1();
    await seedArticle(d1, "half-written", "draft");

    const data = await loadDetail(d1, { articleSlugs: ["half-written"] });
    expect(data.jsonLd).not.toHaveProperty("subjectOf");
  });
});

/*
 * 一覧は `CollectionPage` として名乗り、サイトの一部だと言う (ADR 0048)。
 */
describe("loadWorksPage の JSON-LD (ADR 0048)", () => {
  it("作品があれば、サイトの一部である一覧として名乗る", async () => {
    const d1 = createTestD1();
    await seedWork(d1);

    const { jsonLd } = await loadWorksPage(envWith(d1, createTestR2().bucket), ORIGIN);

    expect(jsonLd).toEqual({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      url: `${ORIGIN}/works`,
      isPartOf: { "@id": `${ORIGIN}/#website` },
    });
  });

  /*
   * 作品が無いあいだ (「準備中」+ noindex) も同じものを名乗る。この場所が在ることは置き
   * 終わる前から言ってよく、検索結果に出すかどうかは noindex が別に決める。
   */
  it("作品が 1 つも無くても同じ一覧として名乗る", async () => {
    const { jsonLd } = await loadWorksPage(envWith(createTestD1(), createTestR2().bucket), ORIGIN);

    expect(jsonLd).toEqual({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      url: `${ORIGIN}/works`,
      isPartOf: { "@id": `${ORIGIN}/#website` },
    });
  });
});

describe("loadWorkDetailPage", () => {
  it("returns the work and its body", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seedWork(d1);
    await new R2WorkContentCache(bucket).putMdast(WorkSlug.create("infoholick"), BODY);

    const data = await loadWorkDetailPage(envWith(d1, bucket), "infoholick", ORIGIN);
    expect(data.work?.name).toBe("infoholick");
    expect(data.mdast).toEqual(BODY);
  });

  it("builds CreativeWork JSON-LD pointing at the canonical URL", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seedWork(d1, { url: "https://github.com/yantene/infoholick" });
    await new R2WorkContentCache(bucket).putMdast(WorkSlug.create("infoholick"), BODY);

    const { jsonLd } = await loadWorkDetailPage(envWith(d1, bucket), "infoholick", ORIGIN);
    expect(jsonLd).toMatchObject({
      "@type": "CreativeWork",
      name: "infoholick",
      description: "読んだものを覚えておくやつ。",
      url: `${ORIGIN}/works/infoholick`,
      sameAs: ["https://github.com/yantene/infoholick"],
      inLanguage: "ja",
    });
  });

  /*
   * 作った人は、記事の筆者や `/about` と同じ 1 人を指す (ADR 0048)。`@id` が揃っていないと、
   * 読む側からは「同じ名前の別人が作ったもの」に見える。
   */
  it("names the author as the creator under the shared @id", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seedWork(d1);
    await new R2WorkContentCache(bucket).putMdast(WorkSlug.create("infoholick"), BODY);
    await new D1ProfileCommandRepository(d1).upsert(
      Profile.create({
        name: ProfileName.create("書き手"),
        tagline: Tagline.create("自己紹介。"),
        socials: [],
        sourceHash: "h1",
      }),
      [],
    );

    const { jsonLd } = await loadWorkDetailPage(envWith(d1, bucket), "infoholick", ORIGIN);

    expect(jsonLd?.creator).toEqual({
      "@type": "Person",
      "@id": personId(ORIGIN),
      name: "書き手",
      url: `${ORIGIN}/about`,
    });
    expect(jsonLd?.isPartOf).toEqual({ "@id": `${ORIGIN}/#website` });
  });

  /* 作品にも経歴を出さない (ADR 0044)。作った人を指す節に欄を足す抜け道を塞ぐ。 */
  it("keeps the history out of the CreativeWork", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seedWork(d1);
    await new R2WorkContentCache(bucket).putMdast(WorkSlug.create("infoholick"), BODY);

    const { jsonLd } = await loadWorkDetailPage(envWith(d1, bucket), "infoholick", ORIGIN);
    const serialized = JSON.stringify(jsonLd);

    for (const key of ["alumniOf", "award", "birthDate", "birthPlace", "worksFor"]) {
      expect(serialized).not.toContain(`"${key}"`);
    }
  });

  /* プロフィールが同期されていなくても、指す先は変えない。名前だけ既定に倒れる。 */
  it("keeps pointing at the same @id before the profile is synced", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seedWork(d1);
    await new R2WorkContentCache(bucket).putMdast(WorkSlug.create("infoholick"), BODY);

    const { jsonLd } = await loadWorkDetailPage(envWith(d1, bucket), "infoholick", ORIGIN);

    expect(jsonLd?.creator).toEqual({
      "@type": "Person",
      "@id": personId(ORIGIN),
      name: FALLBACK_PROFILE_NAME,
      url: `${ORIGIN}/about`,
    });
  });

  /** 外の在り処が無ければ sameAs も出さない (空の配列を置かない)。 */
  it("omits sameAs when the work has no external url", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seedWork(d1);
    await new R2WorkContentCache(bucket).putMdast(WorkSlug.create("infoholick"), BODY);

    const { jsonLd } = await loadWorkDetailPage(envWith(d1, bucket), "infoholick", ORIGIN);
    expect(jsonLd).not.toHaveProperty("sameAs");
  });

  it("returns null for an unknown slug", async () => {
    const data = await loadWorkDetailPage(
      envWith(createTestD1(), createTestR2().bucket),
      "nope",
      ORIGIN,
    );
    expect(data.work).toBeNull();
    expect(data.mdast).toBeNull();
    expect(data.jsonLd).toBeNull();
  });

  /** スラグとして読めない綴りは「無い」と同じ扱い。500 に化けさせない。 */
  it("returns null for an unreadable slug", async () => {
    const data = await loadWorkDetailPage(
      envWith(createTestD1(), createTestR2().bucket),
      "Bad--Name",
      ORIGIN,
    );
    expect(data.work).toBeNull();
  });

  /** D1 に行があるのに本文が無いのは同期の壊れ方。黙って 404 で隠さない。 */
  it("fails loudly when the body is missing from R2", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seedWork(d1);

    await expect(loadWorkDetailPage(envWith(d1, bucket), "infoholick", ORIGIN)).rejects.toThrow(
      "MDAST cache is missing",
    );
  });
});
