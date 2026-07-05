import { describe, expect, it } from "vitest";
import { createNoteAssetsRouter } from "./assets.handler";
import { NoteSlug } from "~/backend/domain/note";
import app from "~/backend/index";
import { createTestD1 } from "~/backend/infra/d1/test-helper";
import { R2NoteContentCache } from "~/backend/infra/r2/r2-note-content-cache";
import { createTestR2 } from "~/backend/infra/r2/test-helper";

function envWith(bucket: R2Bucket): Env {
  return { R2: bucket } as unknown as Env;
}

async function seedAsset(bucket: R2Bucket): Promise<void> {
  await new R2NoteContentCache(bucket).putAsset(
    NoteSlug.create("hello"),
    "cover.png",
    { bytes: new Uint8Array([1, 2, 3]), contentType: "image/png" },
  );
}

describe("createNoteAssetsRouter GET /:slug/assets/:path", () => {
  it("serves a cached asset with its content type and cache headers", async () => {
    const { bucket } = createTestR2();
    const bytes = new Uint8Array([1, 2, 3, 4]);
    await new R2NoteContentCache(bucket).putAsset(
      NoteSlug.create("hello"),
      "cover.png",
      { bytes, contentType: "image/png" },
    );

    const res = await createNoteAssetsRouter().request(
      "/hello/assets/cover.png",
      {},
      envWith(bucket),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Cache-Control")).toContain("max-age");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes);
  });

  it("serves assets nested under subdirectories (slash in path)", async () => {
    const { bucket } = createTestR2();
    await new R2NoteContentCache(bucket).putAsset(
      NoteSlug.create("hello"),
      "img/a.png",
      { bytes: new Uint8Array([9]), contentType: "image/png" },
    );

    const res = await createNoteAssetsRouter().request(
      "/hello/assets/img/a.png",
      {},
      envWith(bucket),
    );
    expect(res.status).toBe(200);
  });

  it("returns 404 for a missing asset", async () => {
    const { bucket } = createTestR2();
    const res = await createNoteAssetsRouter().request(
      "/hello/assets/missing.png",
      {},
      envWith(bucket),
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 for an invalid slug", async () => {
    const { bucket } = createTestR2();
    const res = await createNoteAssetsRouter().request(
      "/Invalid_Slug/assets/x.png",
      {},
      envWith(bucket),
    );
    expect(res.status).toBe(404);
  });

  it("uses public cache-control when BASIC auth is off", async () => {
    const { bucket } = createTestR2();
    await seedAsset(bucket);
    const res = await createNoteAssetsRouter().request(
      "/hello/assets/cover.png",
      {},
      envWith(bucket),
    );
    expect(res.headers.get("Cache-Control")).toContain("public");
  });

  it("uses private cache-control when BASIC auth is enabled (staging)", async () => {
    const { bucket } = createTestR2();
    await seedAsset(bucket);
    const env = {
      R2: bucket,
      BASIC_AUTH_USER: "u",
      BASIC_AUTH_PASS: "p",
    } as unknown as Env;
    const res = await createNoteAssetsRouter().request(
      "/hello/assets/cover.png",
      {},
      env,
    );
    const cacheControl = res.headers.get("Cache-Control");
    expect(cacheControl).toContain("private");
    expect(cacheControl).not.toContain("public");
  });
});

describe("note asset public routing (full app)", () => {
  it("serves assets without a session (mounted before the auth guard)", async () => {
    const { bucket } = createTestR2();
    await seedAsset(bucket);
    const env = {
      R2: bucket,
      D1: createTestD1(),
      KV: {},
    } as unknown as Env;

    const res = await app.request(
      "/api/v1/notes/hello/assets/cover.png",
      {},
      env,
    );
    // 未認証でも 200 (401 でない = auth ガードより前で短絡している)。
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
  });
});
