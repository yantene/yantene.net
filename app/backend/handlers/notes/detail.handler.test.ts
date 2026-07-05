import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import type { NoteDetail } from "./note-detail-view";
import { ImageUrl, Note, NoteSlug, NoteTitle } from "~/backend/domain/note";
import app from "~/backend/index";
import { D1NoteCommandRepository } from "~/backend/infra/d1/repositories";
import { createTestD1 } from "~/backend/infra/d1/test-helper";
import { R2NoteContentCache } from "~/backend/infra/r2/r2-note-content-cache";

/** MDAST の put/get だけを賄う最小 R2 モック。 */
function makeBucket(): R2Bucket {
  const store = new Map<string, string>();
  return {
    put: (key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    },
    get: (key: string) => {
      const found = store.get(key);
      if (found === undefined) return Promise.resolve(null);
      return Promise.resolve({ text: () => Promise.resolve(found) });
    },
  } as unknown as R2Bucket;
}

const sampleMdast = {
  type: "root",
  children: [
    { type: "paragraph", children: [{ type: "text", value: "Body." }] },
  ],
};

async function seed(d1: D1Database, bucket: R2Bucket): Promise<void> {
  await new D1NoteCommandRepository(d1).upsert(
    Note.create({
      slug: NoteSlug.create("hello"),
      title: NoteTitle.create("Hello"),
      summary: "A summary.",
      imageUrl: ImageUrl.create("/api/v1/notes/hello/assets/cover.png"),
      publishedOn: Temporal.PlainDate.from("2026-01-15"),
      lastModifiedOn: Temporal.PlainDate.from("2026-01-16"),
      sourceHash: "h1",
    }),
  );
  await new R2NoteContentCache(bucket).putMdast(
    NoteSlug.create("hello"),
    sampleMdast,
  );
}

function env(d1: D1Database, bucket: R2Bucket): Env {
  // 公開詳細 API は auth ガードより前で短絡するため KV は使わないが、型のため置く。
  return { D1: d1, R2: bucket, KV: {} } as unknown as Env;
}

async function fetchDetail(
  d1: D1Database,
  bucket: R2Bucket,
  slug: string,
): Promise<{ status: number; body: NoteDetail | undefined }> {
  const res = await app.request(`/api/v1/notes/${slug}`, {}, env(d1, bucket));
  const text = await res.text();
  return {
    status: res.status,
    body: res.status === 200 ? (JSON.parse(text) as NoteDetail) : undefined,
  };
}

describe("createNoteDetailApiRouter GET /:slug", () => {
  it("returns note metadata and cached MDAST", async () => {
    const d1 = createTestD1();
    const bucket = makeBucket();
    await seed(d1, bucket);

    const { status, body } = await fetchDetail(d1, bucket, "hello");
    expect(status).toBe(200);
    expect(body?.note.title).toBe("Hello");
    expect(body?.note.imageUrl).toBe("/api/v1/notes/hello/assets/cover.png");
    expect(body?.mdast).toEqual(sampleMdast);
  });

  it("returns 404 when the note metadata is missing", async () => {
    const d1 = createTestD1();
    const bucket = makeBucket();
    const { status } = await fetchDetail(d1, bucket, "missing");
    expect(status).toBe(404);
  });

  it("returns 404 when metadata exists but the MDAST cache is absent", async () => {
    const d1 = createTestD1();
    const bucket = makeBucket();
    await new D1NoteCommandRepository(d1).upsert(
      Note.create({
        slug: NoteSlug.create("no-body"),
        title: NoteTitle.create("No Body"),
        summary: "s",
        publishedOn: Temporal.PlainDate.from("2026-01-15"),
        lastModifiedOn: Temporal.PlainDate.from("2026-01-15"),
        sourceHash: "h2",
      }),
    );
    const { status } = await fetchDetail(d1, bucket, "no-body");
    expect(status).toBe(404);
  });

  it("returns 404 for an invalid slug", async () => {
    const d1 = createTestD1();
    const bucket = makeBucket();
    const { status } = await fetchDetail(d1, bucket, "Invalid_Slug");
    expect(status).toBe(404);
  });
});
