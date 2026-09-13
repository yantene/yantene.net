import type { Work as WorkEntity } from "~/backend/domain/work";
import type { IUnpersisted } from "~/backend/domain/shared";
import { describe, expect, it } from "vitest";
import { D1WorkCommandRepository } from "./work.command-repository";
import { D1WorkQueryRepository } from "./work.query-repository";
import { Work, WorkName, WorkSlug, WorkSummary, WorkUrl } from "~/backend/domain/work";
import { createTestD1 } from "~/backend/infra/d1/test-helper";

function unpersistedWork(params: {
  slug?: string;
  name?: string;
  summary?: string;
  url?: string;
  position?: number;
  sourceHash?: string;
}): WorkEntity<IUnpersisted> {
  return Work.create({
    slug: WorkSlug.create(params.slug ?? "infoholick"),
    name: WorkName.create(params.name ?? "infoholick"),
    summary: WorkSummary.create(params.summary ?? "読んだものを覚えておくやつ。"),
    url: params.url === undefined ? undefined : WorkUrl.create(params.url),
    position: params.position ?? 0,
    sourceHash: params.sourceHash ?? "deadbeef",
  });
}

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
