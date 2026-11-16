import type { Root } from "mdast";
import { describe, expect, it } from "vitest";
import { loadWorkDetailPage, loadWorks, loadWorksPage } from "./pages.handler";
import { Profile, ProfileName, Tagline } from "~/backend/domain/profile";
import { Work, WorkName, WorkSlug, WorkSummary, WorkUrl } from "~/backend/domain/work";
import { personId } from "~/backend/handlers/json-ld";
import {
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
  params: { slug?: string; name?: string; url?: string; position?: number } = {},
): Promise<void> {
  await new D1WorkCommandRepository(d1).upsert(
    Work.create({
      slug: WorkSlug.create(params.slug ?? "infoholick"),
      name: WorkName.create(params.name ?? "infoholick"),
      summary: WorkSummary.create("読んだものを覚えておくやつ。"),
      url: params.url === undefined ? undefined : WorkUrl.create(params.url),
      position: params.position ?? 0,
      sourceHash: "h1",
    }),
  );
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
      },
    ]);
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
