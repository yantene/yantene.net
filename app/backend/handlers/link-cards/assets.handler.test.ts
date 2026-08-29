import { describe, expect, it } from "vitest";
import { createLinkCardAssetsRouter } from "./assets.handler";
import { createTestD1 } from "~/backend/infra/d1/test-helper";
import { R2LinkCardAssetCache } from "~/backend/infra/r2/r2-link-card-asset-cache";
import { createTestR2 } from "~/backend/infra/r2/test-helper";
import { createTestApp } from "~/backend/test-app";

/** 16 進 32 文字であればよい。中身に意味は無いので目に付く形にしておく。 */
const ID = "a".repeat(32);

function envWith(bucket: R2Bucket): Env {
  return { R2: bucket } as unknown as Env;
}

async function seed(bucket: R2Bucket): Promise<void> {
  const cache = new R2LinkCardAssetCache(bucket);
  await cache.putImage(ID, {
    bytes: new Uint8Array([1, 2, 3]),
    contentType: "image/png",
  });
  await cache.putFavicon(ID, {
    bytes: new Uint8Array([4]),
    contentType: "image/x-icon",
  });
}

describe("createLinkCardAssetsRouter", () => {
  it("写した OG 画像を Content-Type 付きで配る", async () => {
    const { bucket } = createTestR2();
    await seed(bucket);

    const res = await createLinkCardAssetsRouter().request(`/${ID}/image`, {}, envWith(bucket));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Cache-Control")).toContain("max-age");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("favicon も配る", async () => {
    const { bucket } = createTestR2();
    await seed(bucket);

    const res = await createLinkCardAssetsRouter().request(`/${ID}/favicon`, {}, envWith(bucket));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/x-icon");
  });

  it("無い画像は 404", async () => {
    const { bucket } = createTestR2();

    const res = await createLinkCardAssetsRouter().request(`/${ID}/image`, {}, envWith(bucket));

    expect(res.status).toBe(404);
  });

  it("id の形が違えば取り合わない", async () => {
    const { bucket } = createTestR2();
    await seed(bucket);

    // 16 進 32 文字でないものはルートに当たらない (R2 のキーに素の入力を混ぜない)。
    for (const id of ["../notes", "ABCDEF", `${ID}0`, "zzzz"]) {
      const res = await createLinkCardAssetsRouter().request(`/${id}/image`, {}, envWith(bucket));
      expect(res.status).toBe(404);
    }
  });

  it("image / favicon 以外の種別は取り合わない", async () => {
    const { bucket } = createTestR2();
    await seed(bucket);

    const res = await createLinkCardAssetsRouter().request(`/${ID}/source`, {}, envWith(bucket));

    expect(res.status).toBe(404);
  });

  it("BASIC 認証のある環境では共有キャッシュに載せない", async () => {
    const { bucket } = createTestR2();
    await seed(bucket);
    const env = {
      R2: bucket,
      BASIC_AUTH_USER: "u",
      BASIC_AUTH_PASS: "p",
    } as unknown as Env;

    const res = await createLinkCardAssetsRouter().request(`/${ID}/image`, {}, env);

    const cacheControl = res.headers.get("Cache-Control");
    expect(cacheControl).toContain("private");
    expect(cacheControl).not.toContain("public");
  });
});

describe("link card asset public routing (full app)", () => {
  it("組み上げたアプリから配信できる", async () => {
    const { bucket } = createTestR2();
    await seed(bucket);
    const env = { R2: bucket, D1: createTestD1() } as unknown as Env;

    const res = await createTestApp().request(`/api/v1/link-cards/${ID}/image`, {}, env);

    // React Router へ落ちず Hono 側が応答している (ダミー委譲は 404 を返す)。
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
  });
});
