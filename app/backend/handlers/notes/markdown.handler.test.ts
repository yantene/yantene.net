import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import { createNoteMarkdownRouter } from "./markdown.handler";
import { Note, NoteSlug, NoteTitle } from "~/backend/domain/note";
import { D1NoteCommandRepository } from "~/backend/infra/d1/repositories";
import { createTestD1 } from "~/backend/infra/d1/test-helper";
import { R2NoteContentCache } from "~/backend/infra/r2/r2-note-content-cache";
import { createTestR2 } from "~/backend/infra/r2/test-helper";
import { createTestApp } from "~/backend/test-app";

const helloMarkdown = `---
title: Hello
imageUrl: ./cover.png
publishedOn: 2026-01-15
---

Body with an inline image ![alt](./inline.png).
`;

function env(d1: D1Database, bucket: R2Bucket): Env {
  return { D1: d1, R2: bucket } as unknown as Env;
}

/** D1 のメタデータだけを入れる (R2 の原文は入れない)。 */
async function seedMeta(d1: D1Database): Promise<void> {
  await new D1NoteCommandRepository(d1).upsert(
    Note.create({
      slug: NoteSlug.create("hello"),
      title: NoteTitle.create("Hello"),
      summary: "A summary.",
      publishedOn: Temporal.PlainDate.from("2026-01-15"),
      lastModifiedOn: Temporal.PlainDate.from("2026-01-16"),
      sourceHash: "h1",
    }),
  );
}

/** メタデータ (D1) と原文 (R2) を揃える。 */
async function seed(d1: D1Database, bucket: R2Bucket): Promise<void> {
  await seedMeta(d1);
  await new R2NoteContentCache(bucket).putSource(
    NoteSlug.create("hello"),
    helloMarkdown,
  );
}

describe("createNoteMarkdownRouter GET /:slug.md", () => {
  it("serves the source markdown verbatim, frontmatter included", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seed(d1, bucket);

    const res = await createNoteMarkdownRouter().request(
      "/hello.md",
      {},
      env(d1, bucket),
    );

    expect(res.status).toBe(200);
    // 原文そのまま: フロントマターも画像の相対パスも書き換えない。
    expect(await res.text()).toBe(helloMarkdown);
  });

  it("returns markdown content type and an inline disposition", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seed(d1, bucket);

    const res = await createNoteMarkdownRouter().request(
      "/hello.md",
      {},
      env(d1, bucket),
    );

    expect(res.headers.get("Content-Type")).toBe(
      "text/markdown; charset=utf-8",
    );
    expect(res.headers.get("Content-Disposition")).toBe(
      'inline; filename="hello.md"',
    );
  });

  it("uses public cache-control when BASIC auth is off", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seed(d1, bucket);

    const res = await createNoteMarkdownRouter().request(
      "/hello.md",
      {},
      env(d1, bucket),
    );

    expect(res.headers.get("Cache-Control")).toContain("public");
  });

  it("uses private cache-control when BASIC auth is enabled (staging)", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seed(d1, bucket);

    const res = await createNoteMarkdownRouter().request(
      "/hello.md",
      {},
      {
        ...env(d1, bucket),
        BASIC_AUTH_USER: "u",
        BASIC_AUTH_PASS: "p",
      },
    );

    const cacheControl = res.headers.get("Cache-Control");
    expect(cacheControl).toContain("private");
    expect(cacheControl).not.toContain("public");
  });

  it("returns 404 Problem Details for an unknown slug", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();

    const res = await createNoteMarkdownRouter().request(
      "/missing.md",
      {},
      env(d1, bucket),
    );

    expect(res.status).toBe(404);
    expect(res.headers.get("Content-Type")).toContain("application/problem");
  });

  it("returns 404 for a slug that is not a valid NoteSlug", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();

    const res = await createNoteMarkdownRouter().request(
      "/Invalid_Slug.md",
      {},
      env(d1, bucket),
    );

    expect(res.status).toBe(404);
  });
});

/** ページ委譲 (`app.all("*")`) は executionCtx を触るのでダミーを渡す。 */
function executionCtx(): ExecutionContext {
  return {
    waitUntil: () => {},
    passThroughOnException: () => {},
  } as unknown as ExecutionContext;
}

describe("note markdown routing (full app)", () => {
  it("serves /notes/<slug>.md from Hono without a session", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seed(d1, bucket);

    const res = await createTestApp().request(
      "/notes/hello.md",
      {},
      env(d1, bucket),
      executionCtx(),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "text/markdown; charset=utf-8",
    );
  });

  it("leaves /notes/<slug> (no .md) to the page router", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seed(d1, bucket);

    const res = await createTestApp().request(
      "/notes/hello",
      {},
      env(d1, bucket),
      executionCtx(),
    );

    // test-app のページ委譲はダミー (404 "Not Found") なので、本文で「Hono が
    // 応答せずページ側に落ちた」ことを観測する。
    expect(await res.text()).toBe("Not Found");
  });

  it("leaves /notes (index) to the page router", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();

    const res = await createTestApp().request(
      "/notes",
      {},
      env(d1, bucket),
      executionCtx(),
    );

    expect(await res.text()).toBe("Not Found");
  });

  it("fails loud (500, not silent 404) when an indexed note has no cached source", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seedMeta(d1);

    const res = await createTestApp().request(
      "/notes/hello.md",
      {},
      env(d1, bucket),
      executionCtx(),
    );

    // D1 に在るのに R2 に原文が無い = キャッシュ不整合。404 で隠さず 500 で表面化させる。
    expect(res.status).toBe(500);
  });
});
