import { describe, expect, it } from "vitest";
import { createProfileAssetsRouter } from "./assets.handler";
import { Profile, ProfileName, Tagline } from "~/backend/domain/profile";
import { D1ProfileCommandRepository } from "~/backend/infra/d1/repositories";
import { createTestD1 } from "~/backend/infra/d1/test-helper";
import { R2ProfileContentCache } from "~/backend/infra/r2/r2-profile-content-cache";
import { createTestR2 } from "~/backend/infra/r2/test-helper";
import { createTestApp } from "~/backend/test-app";

function envWith(d1: D1Database, bucket: R2Bucket): Env {
  return { D1: d1, R2: bucket } as unknown as Env;
}

/** 索引にプロフィールを入れる。配信はこの行が在ることを条件にする (#316)。 */
async function seedProfile(d1: D1Database): Promise<void> {
  await new D1ProfileCommandRepository(d1).upsert(
    Profile.create({
      name: ProfileName.create("やんてね"),
      tagline: Tagline.create("東京で Web 開発者をやっています。"),
      socials: [],
      sourceHash: "h1",
    }),
  );
}

async function seedAsset(bucket: R2Bucket, path = "avatar.png"): Promise<Uint8Array> {
  const bytes = new Uint8Array([1, 2, 3, 4]);
  await new R2ProfileContentCache(bucket).putAsset(path, { bytes, contentType: "image/png" });
  return bytes;
}

describe("createProfileAssetsRouter GET /assets/:path", () => {
  it("serves a cached asset with its content type and cache headers", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seedProfile(d1);
    const bytes = await seedAsset(bucket);

    const res = await createProfileAssetsRouter().request(
      "/assets/avatar.png",
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
    await seedProfile(d1);
    await seedAsset(bucket, "img/a.png");

    const res = await createProfileAssetsRouter().request(
      "/assets/img/a.png",
      {},
      envWith(d1, bucket),
    );
    expect(res.status).toBe(200);
  });

  it("returns 404 when the asset is missing", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seedProfile(d1);

    const res = await createProfileAssetsRouter().request(
      "/assets/nope.png",
      {},
      envWith(d1, bucket),
    );
    expect(res.status).toBe(404);
    expect(res.headers.get("Content-Type")).toContain("application/problem+json");
  });

  /*
   * 同期がアセットの書き込みまで進んで upsert の手前で落ちると、D1 に行の無い顔写真が
   * R2 に残る。掃除は D1 の行を辿るので届かない (#316)。
   */
  it("returns 404 when R2 has the asset but D1 has no profile", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seedAsset(bucket);

    const res = await createProfileAssetsRouter().request(
      "/assets/avatar.png",
      {},
      envWith(d1, bucket),
    );
    expect(res.status).toBe(404);
  });

  it("marks the response private while BASIC auth is on (staging)", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seedProfile(d1);
    await seedAsset(bucket);
    const env = {
      D1: d1,
      R2: bucket,
      BASIC_AUTH_USER: "u",
      BASIC_AUTH_PASS: "p",
    } as unknown as Env;

    const res = await createProfileAssetsRouter().request("/assets/avatar.png", {}, env);
    expect(res.headers.get("Cache-Control")).toContain("private");
  });

  /** Hono 側が応答していること (React Router へ委譲されていない)。 */
  it("is reachable through the composed app", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seedProfile(d1);
    await seedAsset(bucket);

    const res = await createTestApp().request(
      "/api/v1/profile/assets/avatar.png",
      {},
      envWith(d1, bucket),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
  });
});
