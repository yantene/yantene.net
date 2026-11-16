import type { Work as WorkEntity } from "~/backend/domain/work";
import type { IUnpersisted } from "~/backend/domain/shared";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { D1_BOUND_PARAMETER_LIMIT } from "./profile.command-repository";
import {
  ARTICLE_LINK_ROWS_PER_STATEMENT,
  D1WorkCommandRepository,
  SCREENSHOT_ROWS_PER_STATEMENT,
} from "./work.command-repository";
import { D1WorkQueryRepository } from "./work.query-repository";
import { ArticleSlug } from "~/backend/domain/article";
import { HistoryDate } from "~/backend/domain/profile";
import {
  Work,
  WorkName,
  WorkPeriod,
  WorkRole,
  WorkScreenshot,
  WorkSlug,
  WorkStack,
  WorkSummary,
  WorkUrl,
} from "~/backend/domain/work";
import { workArticles, workScreenshots } from "~/backend/infra/d1/schema";
import { createTestD1 } from "~/backend/infra/d1/test-helper";

function unpersistedWork(params: {
  slug?: string;
  name?: string;
  summary?: string;
  url?: string;
  position?: number;
  sourceHash?: string;
  screenshots?: readonly WorkScreenshot[];
  articleSlugs?: readonly string[];
}): WorkEntity<IUnpersisted> {
  return Work.create({
    slug: WorkSlug.create(params.slug ?? "infoholick"),
    name: WorkName.create(params.name ?? "infoholick"),
    summary: WorkSummary.create(params.summary ?? "読んだものを覚えておくやつ。"),
    url: params.url === undefined ? undefined : WorkUrl.create(params.url),
    position: params.position ?? 0,
    screenshots: params.screenshots ?? [],
    articleSlugs: (params.articleSlugs ?? []).map((slug) => ArticleSlug.create(slug)),
    sourceHash: params.sourceHash ?? "deadbeef",
  });
}

function screenshot(name: string): WorkScreenshot {
  return WorkScreenshot.create({
    src: `/api/v1/works/infoholick/assets/${name}.png`,
    alt: `${name} の画面`,
    dimensions: { width: 1600, height: 900 },
  });
}

async function countRows(d1: D1Database, table: string): Promise<number> {
  const row = await d1.prepare(`SELECT count(*) AS n FROM ${table}`).first<{ n: number }>();
  return row?.n ?? 0;
}

/**
 * ⚠️ **1 文あたりのパラメータ数が D1 の上限を超えていないこと。**
 *
 * 超えると insert 1 文ではなく batch ごと落ち、その作品の同期まるごとが止まる。
 * **手元では踏めない** (`createTestD1` は node:sqlite) ので、数で見張る。列の数は schema
 * から数えるので、欄を 1 つ足したら行数を切り直すまでここが落ちる。
 */
describe("D1 のバインドパラメータ上限", () => {
  it.each([
    ["work_screenshots", workScreenshots, SCREENSHOT_ROWS_PER_STATEMENT],
    ["work_articles", workArticles, ARTICLE_LINK_ROWS_PER_STATEMENT],
  ])("%s は 1 文が上限に収まる", (_label, table, rowsPerStatement) => {
    const columns = Object.keys(getTableColumns(table)).length;

    expect(columns * rowsPerStatement).toBeLessThanOrEqual(D1_BOUND_PARAMETER_LIMIT);
  });
});

describe("足した欄", () => {
  /** どの欄も書いていない作品 (migration より前からある行と同じ姿)。 */
  it("reads back the defaults for a work that writes none of them", async () => {
    const d1 = createTestD1();
    await new D1WorkCommandRepository(d1).upsert(unpersistedWork({}));

    const work = await new D1WorkQueryRepository(d1).findBySlug(WorkSlug.create("infoholick"));
    expect(work?.featured).toBe(false);
    expect(work?.stack.toArray()).toEqual([]);
    expect(work?.period).toBeUndefined();
    expect(work?.role).toBeUndefined();
    expect(work?.screenshots).toEqual([]);
    expect(work?.articleSlugs).toEqual([]);
  });

  /** migration が既存の行に入れる既定値のままでも読めること (書き込み経路を通っていない行)。 */
  it("reads a row inserted without the added columns", async () => {
    const d1 = createTestD1();
    await d1
      .prepare(
        "INSERT INTO works (id, slug, name, summary, position, created_at, updated_at) VALUES ('w1', 'arerd', 'arerd', 'あれだ。', 0, 1, 1)",
      )
      .run();

    const [work] = await new D1WorkQueryRepository(d1).list();
    expect(work?.stack.toArray()).toEqual([]);
    expect(work?.featured).toBe(false);
  });

  it("stores and reads back every added field", async () => {
    const d1 = createTestD1();
    await new D1WorkCommandRepository(d1).upsert(
      Work.create({
        slug: WorkSlug.create("infoholick"),
        name: WorkName.create("infoholick"),
        summary: WorkSummary.create("読んだものを覚えておくやつ。"),
        position: 0,
        stack: WorkStack.create(["TypeScript", "Hono"]),
        period: WorkPeriod.create({
          from: HistoryDate.create("2024-06"),
          until: HistoryDate.create("2025-03"),
        }),
        role: WorkRole.create("設計から運用まで"),
        featured: true,
        screenshots: [
          screenshot("top"),
          WorkScreenshot.create({ src: "/a/reader.png", alt: "記事の画面", kind: "mobile" }),
        ],
        articleSlugs: [ArticleSlug.create("second"), ArticleSlug.create("first")],
        sourceHash: "h",
      }),
    );

    const work = await new D1WorkQueryRepository(d1).findBySlug(WorkSlug.create("infoholick"));
    expect(work?.stack.toArray()).toEqual(["TypeScript", "Hono"]);
    expect(work?.period?.toJSON()).toEqual({ from: "2024-06", until: "2025-03" });
    expect(work?.role?.toString()).toBe("設計から運用まで");
    expect(work?.featured).toBe(true);
    expect(work?.screenshots.map((shot) => shot.toJSON())).toEqual([
      {
        src: "/api/v1/works/infoholick/assets/top.png",
        alt: "top の画面",
        kind: "desktop",
        width: 1600,
        height: 900,
      },
      {
        src: "/a/reader.png",
        alt: "記事の画面",
        kind: "mobile",
        width: undefined,
        height: undefined,
      },
    ]);
    // 書いた順のまま。slug の順には並べ直さない。
    expect(work?.articleSlugs.map((slug) => slug.toString())).toEqual(["second", "first"]);
  });

  it("replaces the children instead of appending to them", async () => {
    const d1 = createTestD1();
    const command = new D1WorkCommandRepository(d1);
    await command.upsert(
      unpersistedWork({
        screenshots: [screenshot("a"), screenshot("b")],
        articleSlugs: ["first", "second"],
      }),
    );
    await command.upsert(unpersistedWork({ screenshots: [screenshot("c")], articleSlugs: [] }));

    const work = await new D1WorkQueryRepository(d1).findBySlug(WorkSlug.create("infoholick"));
    expect(work?.screenshots.map((shot) => shot.alt)).toEqual(["c の画面"]);
    expect(work?.articleSlugs).toEqual([]);
    expect(await countRows(d1, "work_screenshots")).toBe(1);
    expect(await countRows(d1, "work_articles")).toBe(0);
  });

  /** 1 文に収まらない数でも、切って全部入ること。 */
  it("stores more children than fit in one statement", async () => {
    const d1 = createTestD1();
    const shots = Array.from({ length: SCREENSHOT_ROWS_PER_STATEMENT + 3 }, (_unused, index) =>
      screenshot(`shot-${String(index)}`),
    );
    const slugs = Array.from(
      { length: ARTICLE_LINK_ROWS_PER_STATEMENT + 3 },
      (_unused, index) => `article-${String(index)}`,
    );
    await new D1WorkCommandRepository(d1).upsert(
      unpersistedWork({ screenshots: shots, articleSlugs: slugs }),
    );

    const work = await new D1WorkQueryRepository(d1).findBySlug(WorkSlug.create("infoholick"));
    expect(work?.screenshots).toHaveLength(shots.length);
    expect(work?.articleSlugs.map((slug) => slug.toString())).toEqual(slugs);
  });

  /** 子の行が別の作品に混ざらないこと (一覧は全件を引いてから束ねている)。 */
  it("keeps the children of each work apart when listing", async () => {
    const d1 = createTestD1();
    const command = new D1WorkCommandRepository(d1);
    await command.upsert(
      unpersistedWork({ slug: "alpha", position: 0, screenshots: [screenshot("a")] }),
    );
    await command.upsert(
      unpersistedWork({
        slug: "beta",
        position: 1,
        screenshots: [screenshot("b1"), screenshot("b2")],
        articleSlugs: ["only-beta"],
      }),
    );

    const [alpha, beta] = await new D1WorkQueryRepository(d1).list();
    expect(alpha?.screenshots.map((shot) => shot.alt)).toEqual(["a の画面"]);
    expect(alpha?.articleSlugs).toEqual([]);
    expect(beta?.screenshots.map((shot) => shot.alt)).toEqual(["b1 の画面", "b2 の画面"]);
    expect(beta?.articleSlugs.map((slug) => slug.toString())).toEqual(["only-beta"]);
  });

  /** D1 は FK の cascade を強制しないので、子の行は明示的に消している。 */
  it("deletes the children along with the work", async () => {
    const d1 = createTestD1();
    const command = new D1WorkCommandRepository(d1);
    await command.upsert(
      unpersistedWork({ screenshots: [screenshot("a")], articleSlugs: ["first"] }),
    );
    await command.upsert(
      unpersistedWork({ slug: "other", screenshots: [screenshot("o")], articleSlugs: ["first"] }),
    );

    await command.deleteBySlug(WorkSlug.create("infoholick"));

    expect(await countRows(d1, "work_screenshots")).toBe(1);
    expect(await countRows(d1, "work_articles")).toBe(1);
  });

  it("does nothing when deleting a work that is not there", async () => {
    const d1 = createTestD1();
    await expect(
      new D1WorkCommandRepository(d1).deleteBySlug(WorkSlug.create("nope")),
    ).resolves.toBeUndefined();
  });
});

describe("D1WorkCommandRepository", () => {
  it("inserts a work and reads it back", async () => {
    const d1 = createTestD1();
    await new D1WorkCommandRepository(d1).upsert(
      unpersistedWork({ url: "https://github.com/yantene/infoholick" }),
    );

    const work = await new D1WorkQueryRepository(d1).findBySlug(WorkSlug.create("infoholick"));
    expect(work?.name.toString()).toBe("infoholick");
    expect(work?.summary.toString()).toBe("読んだものを覚えておくやつ。");
    expect(work?.url?.toString()).toBe("https://github.com/yantene/infoholick");
  });

  /** 外に出していない作品もあるので、リンクの無い行を書けること。 */
  it("stores a work without a url", async () => {
    const d1 = createTestD1();
    await new D1WorkCommandRepository(d1).upsert(unpersistedWork({}));

    const work = await new D1WorkQueryRepository(d1).findBySlug(WorkSlug.create("infoholick"));
    expect(work?.url).toBeUndefined();
  });

  /** slug が同じなら上書き。id と created_at は据え置く。 */
  it("keeps the id and created_at when upserting the same slug", async () => {
    const d1 = createTestD1();
    const command = new D1WorkCommandRepository(d1);
    const query = new D1WorkQueryRepository(d1);

    await command.upsert(unpersistedWork({ summary: "前の概要。" }));
    const before = await query.findBySlug(WorkSlug.create("infoholick"));

    await command.upsert(unpersistedWork({ summary: "後の概要。", sourceHash: "cafe" }));
    const after = await query.findBySlug(WorkSlug.create("infoholick"));

    expect(after?.id).toBe(before?.id);
    expect(after?.createdAt.epochMilliseconds).toBe(before?.createdAt.epochMilliseconds);
    expect(after?.summary.toString()).toBe("後の概要。");
    expect(after?.sourceHash).toBe("cafe");
  });

  it("deletes by slug", async () => {
    const d1 = createTestD1();
    const command = new D1WorkCommandRepository(d1);
    await command.upsert(unpersistedWork({}));
    await command.deleteBySlug(WorkSlug.create("infoholick"));

    expect(await new D1WorkQueryRepository(d1).list()).toEqual([]);
  });
});

describe("D1WorkQueryRepository", () => {
  it("lists works in the written order", async () => {
    const d1 = createTestD1();
    const command = new D1WorkCommandRepository(d1);
    await command.upsert(unpersistedWork({ slug: "arerd", position: 2 }));
    await command.upsert(unpersistedWork({ slug: "infoholick", position: 0 }));
    await command.upsert(unpersistedWork({ slug: "openapi-sorbet-rails", position: 1 }));

    const works = await new D1WorkQueryRepository(d1).list();
    expect(works.map((work) => work.slug.toString())).toEqual([
      "infoholick",
      "openapi-sorbet-rails",
      "arerd",
    ]);
  });

  /*
   * 同じ position を 2 つ書くのは書き手の誤りだが、refresh のたびに順が入れ替わるより
   * 決まった順で出続けるほうが気づきやすい。
   */
  it("breaks a tie on position by slug", async () => {
    const d1 = createTestD1();
    const command = new D1WorkCommandRepository(d1);
    await command.upsert(unpersistedWork({ slug: "zeta", position: 1 }));
    await command.upsert(unpersistedWork({ slug: "alpha", position: 1 }));

    const works = await new D1WorkQueryRepository(d1).list();
    expect(works.map((work) => work.slug.toString())).toEqual(["alpha", "zeta"]);
  });

  it("returns undefined for an unknown slug", async () => {
    const d1 = createTestD1();
    expect(await new D1WorkQueryRepository(d1).findBySlug(WorkSlug.create("nope"))).toBeUndefined();
  });

  it("lists source hashes for change detection", async () => {
    const d1 = createTestD1();
    const command = new D1WorkCommandRepository(d1);
    await command.upsert(unpersistedWork({ slug: "infoholick", sourceHash: "h1" }));
    await command.upsert(unpersistedWork({ slug: "arerd", sourceHash: "h2" }));

    const hashes = await new D1WorkQueryRepository(d1).listSourceHashes();
    expect(hashes).toEqual(
      new Map([
        ["infoholick", "h1"],
        ["arerd", "h2"],
      ]),
    );
  });
});
