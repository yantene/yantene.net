import { afterEach, describe, expect, it, vi } from "vitest";
import { createSlideAssetsRouter } from "./assets.handler";
import type { ContentStatus } from "~/backend/domain/shared";
import * as currentAccountModule from "~/backend/handlers/auth/current-account";
import { Temporal } from "@js-temporal/polyfill";
import { Slide, SlideSlug, SlideTitle } from "~/backend/domain/slide";
import { D1SlideCommandRepository } from "~/backend/infra/d1/repositories";
import { createTestD1 } from "~/backend/infra/d1/test-helper";
import { R2SlideContentCache } from "~/backend/infra/r2/r2-slide-content-cache";
import { createTestR2 } from "~/backend/infra/r2/test-helper";
import { createTestApp } from "~/backend/test-app";

function envWith(d1: D1Database, bucket: R2Bucket): Env {
  return { D1: d1, R2: bucket } as unknown as Env;
}

/** 索引にスライドを入れる。配信はこの行が在ることを条件にする (#316)。 */
async function seedSlide(d1: D1Database, status: ContentStatus = "published"): Promise<void> {
  await new D1SlideCommandRepository(d1).upsert(
    Slide.create({
      slug: SlideSlug.create("semantic-slides"),
      title: SlideTitle.create("意味だけで書くスライド"),
      publishedOn: Temporal.PlainDate.from("2026-11-14"),
      summary: "",
      pageCount: 2,
      status,
      sourceHash: "h1",
    }),
  );
}

async function seedAsset(bucket: R2Bucket, path = "diagram.png"): Promise<Uint8Array> {
  const bytes = new Uint8Array([1, 2, 3, 4]);
  await new R2SlideContentCache(bucket).putAsset(SlideSlug.create("semantic-slides"), path, {
    bytes,
    contentType: "image/png",
  });
  return bytes;
}

describe("createSlideAssetsRouter GET /:slug/assets/:path", () => {
  it("serves a cached asset with its content type and cache headers", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seedSlide(d1);
    const bytes = await seedAsset(bucket);

    const res = await createSlideAssetsRouter().request(
      "/semantic-slides/assets/diagram.png",
      {},
      envWith(d1, bucket),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Cache-Control")).toContain("max-age");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes);
  });

  it("serves assets nested under subdirectories (slash in path)", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seedSlide(d1);
    await seedAsset(bucket, "img/a.png");

    const res = await createSlideAssetsRouter().request(
      "/semantic-slides/assets/img/a.png",
      {},
      envWith(d1, bucket),
    );
    expect(res.status).toBe(200);
  });

  it("returns 404 when the asset is missing", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seedSlide(d1);

    const res = await createSlideAssetsRouter().request(
      "/semantic-slides/assets/nope.png",
      {},
      envWith(d1, bucket),
    );
    expect(res.status).toBe(404);
    expect(res.headers.get("Content-Type")).toContain("application/problem+json");
  });

  /** スラグとして読めない綴りは 404。読めないことを 500 に化けさせない。 */
  it("returns 404 for an unreadable slug", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();

    const res = await createSlideAssetsRouter().request(
      "/Bad--Name/assets/diagram.png",
      {},
      envWith(d1, bucket),
    );
    expect(res.status).toBe(404);
  });

  /*
   * 同期がアセットの書き込みまで進んで upsert の手前で落ちると、D1 に行の無い絵が
   * R2 に残る。掃除は D1 の行を辿るので届かない (#316)。
   */
  it("returns 404 when R2 has the asset but D1 has no slide", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seedAsset(bucket);

    const res = await createSlideAssetsRouter().request(
      "/semantic-slides/assets/diagram.png",
      {},
      envWith(d1, bucket),
    );
    expect(res.status).toBe(404);
  });

  it("marks the response private while BASIC auth is on (staging)", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seedSlide(d1);
    await seedAsset(bucket);
    const env = {
      D1: d1,
      R2: bucket,
      BASIC_AUTH_USER: "u",
      BASIC_AUTH_PASS: "p",
    } as unknown as Env;

    const res = await createSlideAssetsRouter().request(
      "/semantic-slides/assets/diagram.png",
      {},
      env,
    );
    expect(res.headers.get("Cache-Control")).toContain("private");
  });

  /** Hono 側が応答していること (React Router へ委譲されていない)。 */
  it("is reachable through the composed app", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seedSlide(d1);
    await seedAsset(bucket);

    const res = await createTestApp().request(
      "/api/v1/slides/semantic-slides/assets/diagram.png",
      {},
      envWith(d1, bucket),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
  });
});

/*
 * status ごとのアセットの配信 (ADR 0040)。下書きを確かめるときに絵だけ 404 に
 * ならないよう、ページと同じ判定を通す。記事のアセットと同じ表になること。
 */
describe("status ごとのアセットの配信 (ADR 0040)", () => {
  async function fetchAsset(status: ContentStatus): Promise<Response> {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seedSlide(d1, status);
    await seedAsset(bucket);
    return createSlideAssetsRouter().request(
      "/semantic-slides/assets/diagram.png",
      {},
      envWith(d1, bucket),
    );
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

  it.each(["withdrawn", "draft", "idea"] as const)("%s の絵は読み手に 404", async (status) => {
    expect((await fetchAsset(status)).status).toBe(404);
  });

  it("unlisted の絵は読み手も取れるが noindex を伝える", async () => {
    const response = await fetchAsset("unlisted");

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
  });

  it("published の絵に noindex は付けない", async () => {
    expect((await fetchAsset("published")).headers.get("X-Robots-Tag")).toBeNull();
  });

  it.each(["withdrawn", "draft", "idea"] as const)(
    "管理者は %s の絵を取れて、応答は共有キャッシュに載らない",
    async (status) => {
      asAdmin();

      const response = await fetchAsset(status);

      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      expect(response.headers.get("Vary")).toContain("Cookie");
    },
  );

  it.each(["published", "unlisted"] as const)(
    "管理者が %s の絵を取っても共有キャッシュから遠ざけない",
    async (status) => {
      asAdmin();

      const response = await fetchAsset(status);

      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toContain("max-age");
    },
  );
});
