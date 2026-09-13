import type { Root } from "mdast";
import { describe, expect, it } from "vitest";
import { loadWorkDetailPage, loadWorks, loadWorksPage } from "./pages.handler";
import { Work, WorkName, WorkSlug, WorkSummary, WorkUrl } from "~/backend/domain/work";
import { D1WorkCommandRepository } from "~/backend/infra/d1/repositories";
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

    const { works } = await loadWorksPage(envWith(d1, createTestR2().bucket));
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
