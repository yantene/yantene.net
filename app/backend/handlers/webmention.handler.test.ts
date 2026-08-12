/*
 * @vitest-environment node
 *
 * 送り元の取得を差し替えるために global の fetch を差し替え、応答の本文を
 * ストリームとして読ませる。happy-dom の Response は body の扱いが素の実装と
 * 異なるので、ここは node で走らせる。
 */
import { Temporal } from "@js-temporal/polyfill";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NoteId } from "~/backend/domain/note";
import { Note, NoteSlug, NoteTitle } from "~/backend/domain/note";
import {
  D1NoteCommandRepository,
  D1WebmentionQueryRepository,
} from "~/backend/infra/d1/repositories";
import { createTestD1 } from "~/backend/infra/d1/test-helper";
import { createTestApp } from "~/backend/test-app";

const SITE = "https://yantene.net";
const TARGET = `${SITE}/notes/alpha`;
const SOURCE = "https://example.com/post/1";

const LINKING_HTML = `
  <div class="h-entry">
    <div class="p-author h-card"><span class="p-name">Alice</span></div>
    <a class="u-in-reply-to" href="${TARGET}">re</a>
    <div class="e-content"><p>いい記事だった</p></div>
  </div>`;

interface Harness {
  readonly env: Env;
  readonly noteId: NoteId;
  /** waitUntil に渡された処理が終わるまで待つ。 */
  readonly settle: () => Promise<void>;
  readonly executionCtx: ExecutionContext;
}

async function setup(): Promise<Harness> {
  const d1 = createTestD1();
  const note = await new D1NoteCommandRepository(d1).upsert(
    Note.create({
      slug: NoteSlug.create("alpha"),
      title: NoteTitle.create("Alpha"),
      summary: "summary",
      imageUrl: undefined,
      publishedOn: Temporal.PlainDate.from("2026-01-15"),
      lastModifiedOn: Temporal.PlainDate.from("2026-01-15"),
      sourceHash: "hash-0",
    }),
  );

  const pending: Promise<unknown>[] = [];
  return {
    env: { D1: d1, APP_ENV: "test" } as unknown as Env,
    noteId: note.id,
    settle: async () => {
      await Promise.all(pending);
    },
    executionCtx: {
      waitUntil: (promise: Promise<unknown>) => {
        pending.push(promise);
      },
      passThroughOnException: () => {},
      props: {},
    } as unknown as ExecutionContext,
  };
}

/** source の取得を差し替える。undefined なら取りに行けなかったことにする。 */
function stubSource(html: string | undefined): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      html === undefined
        ? Promise.reject(new Error("network down"))
        : Promise.resolve(
            new Response(html, {
              headers: { "content-type": "text/html; charset=utf-8" },
            }),
          ),
    ),
  );
}

/** 応答を返さない source。黙り込んでいる相手を表す。 */
function stubSilentSource(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise<Response>(() => {})),
  );
}

async function post(
  harness: Harness,
  form: Record<string, string>,
): Promise<Response> {
  return await createTestApp().request(
    `${SITE}/webmention`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(form).toString(),
    },
    harness.env,
    harness.executionCtx,
  );
}

function stored(harness: Harness): Promise<readonly unknown[]> {
  return new D1WebmentionQueryRepository(harness.env.D1).listByNoteId(
    harness.noteId,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /webmention", () => {
  it("受け付けたら 202 を返す", async () => {
    const harness = await setup();
    stubSource(LINKING_HTML);

    const response = await post(harness, { source: SOURCE, target: TARGET });

    expect(response.status).toBe(202);
  });

  /* 検証は送り手を待たせずに行う。相手が黙っていても応答は返る。 */
  it("source の応答を待たずに 202 を返す", async () => {
    const harness = await setup();
    stubSilentSource();

    const response = await post(harness, { source: SOURCE, target: TARGET });

    expect(response.status).toBe(202);
    // 検証はまだ終わっていないので、この時点では何も入っていない。
    expect(await stored(harness)).toEqual([]);
  });

  it("検証を通れば、種別・著者・本文を読んで保存する", async () => {
    const harness = await setup();
    stubSource(LINKING_HTML);

    await post(harness, { source: SOURCE, target: TARGET });
    await harness.settle();

    const rows = await new D1WebmentionQueryRepository(
      harness.env.D1,
    ).listByNoteId(harness.noteId);
    expect(rows).toHaveLength(1);
    expect(rows[0].source.toString()).toBe(SOURCE);
    expect(rows[0].type.toString()).toBe("reply");
    expect(rows[0].author.name).toBe("Alice");
    expect(rows[0].content?.toString()).toBe("いい記事だった");
  });

  it("target をリンクしていなければ保存しない", async () => {
    const harness = await setup();
    stubSource("<p>関係のない記事</p>");

    await post(harness, { source: SOURCE, target: TARGET });
    await harness.settle();

    expect(await stored(harness)).toEqual([]);
  });

  /* 相手が落ちているのは異常ではない。202 は返したまま、保存だけ見送る。 */
  it("source を取りに行けなくても落ちない", async () => {
    const harness = await setup();
    stubSource(undefined);

    const response = await post(harness, { source: SOURCE, target: TARGET });
    await harness.settle();

    expect(response.status).toBe(202);
    expect(await stored(harness)).toEqual([]);
  });

  it("再送しても行は増えない", async () => {
    const harness = await setup();
    stubSource(LINKING_HTML);

    await post(harness, { source: SOURCE, target: TARGET });
    await post(harness, { source: SOURCE, target: TARGET });
    await harness.settle();

    expect(await stored(harness)).toHaveLength(1);
  });

  /* リンクが消えたら取り消し扱い。Webmention は「いまリンクされているか」を映す。 */
  it("リンクが消えたら保存済みの行を落とす", async () => {
    const harness = await setup();
    stubSource(LINKING_HTML);
    await post(harness, { source: SOURCE, target: TARGET });
    await harness.settle();

    stubSource("<p>書き直した</p>");
    await post(harness, { source: SOURCE, target: TARGET });
    await harness.settle();

    expect(await stored(harness)).toEqual([]);
  });

  describe("同期段で断るもの", () => {
    it.each([
      ["source が無い", { target: TARGET }],
      ["target が無い", { source: SOURCE }],
      ["source が URL でない", { source: "nope", target: TARGET }],
      [
        "source が http/https でない",
        { source: "ftp://example.com/x", target: TARGET },
      ],
      ["target が URL でない", { source: SOURCE, target: "nope" }],
      ["source と target が同じ", { source: TARGET, target: TARGET }],
      [
        "target が他所のサイト",
        { source: SOURCE, target: "https://example.org/notes/alpha" },
      ],
      [
        "target がノートの URL でない",
        { source: SOURCE, target: `${SITE}/notes` },
      ],
      [
        "target のノートが存在しない",
        { source: SOURCE, target: `${SITE}/notes/missing` },
      ],
      ["source が自サイト", { source: `${SITE}/notes/other`, target: TARGET }],
    ])("%s なら 400", async (_name, form) => {
      const harness = await setup();
      stubSource(LINKING_HTML);

      const response = await post(harness, form);

      expect(response.status).toBe(400);
      expect(response.headers.get("content-type")).toContain(
        "application/problem+json",
      );
    });

    /* 誰でも叩ける口なので、読み込む前に本文の大きさで頭を押さえる。 */
    it("本文が大きすぎれば 413", async () => {
      const harness = await setup();
      stubSource(LINKING_HTML);

      const response = await post(harness, {
        source: SOURCE,
        target: TARGET,
        padding: "x".repeat(8192),
      });

      expect(response.status).toBe(413);
    });

    it("断ったときは source を取りに行かない", async () => {
      const harness = await setup();
      stubSource(LINKING_HTML);

      await post(harness, { source: SOURCE, target: `${SITE}/notes/missing` });
      await harness.settle();

      expect(globalThis.fetch).not.toHaveBeenCalled();
    });
  });
});
