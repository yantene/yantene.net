import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import { loadNotesListPage } from "./pages.handler";
import type { NotesListPageData } from "./pages.handler";
import type { IUnpersisted } from "~/backend/domain/shared";
import { Note, NoteSlug, NoteTag, NoteTitle } from "~/backend/domain/note";
import {
  D1NoteCommandRepository,
  D1NoteSearchIndex,
} from "~/backend/infra/d1/repositories";
import { createTestD1 } from "~/backend/infra/d1/test-helper";

function note(
  slug: string,
  publishedOn: string,
  tags: readonly string[],
): Note<IUnpersisted> {
  return Note.create({
    slug: NoteSlug.create(slug),
    title: NoteTitle.create(slug),
    summary: `summary of ${slug}`,
    tags: tags.map((tag) => NoteTag.create(tag)),
    publishedOn: Temporal.PlainDate.from(publishedOn),
    lastModifiedOn: Temporal.PlainDate.from(publishedOn),
    sourceHash: `hash-${slug}`,
  });
}

async function seed(d1: D1Database): Promise<void> {
  const cmd = new D1NoteCommandRepository(d1);
  const index = new D1NoteSearchIndex(d1);
  for (const [slug, publishedOn, tags] of [
    ["alpha", "2026-01-10", ["Web", "日記"]],
    ["bravo", "2025-03-10", ["Web"]],
    ["charlie", "2024-02-10", ["日記"]],
  ] as const) {
    await cmd.upsert(note(slug, publishedOn, tags));
    // 検索は索引を引く。本文を持たないので、表題と要約だけ入れておく。
    await index.index({
      slug: NoteSlug.create(slug),
      title: slug,
      body: `summary of ${slug}`,
    });
  }
}

const envWith = (d1: D1Database): Env => ({ D1: d1 }) as unknown as Env;

const load = (d1: D1Database, search: string): Promise<NotesListPageData> =>
  loadNotesListPage(envWith(d1), new URL(`https://example.com/notes${search}`));

describe("loadNotesListPage", () => {
  it("絞り込みがなければ公開日の新しい順に全件返す", async () => {
    const d1 = createTestD1();
    await seed(d1);

    const page = await load(d1, "");
    expect(page.notes.map((n) => n.slug)).toEqual([
      "alpha",
      "bravo",
      "charlie",
    ]);
    expect(page.query).toBe("");
    expect(page.tag).toBeNull();
  });

  it("タグの索引を、記事数の多い順に添える", async () => {
    const d1 = createTestD1();
    await seed(d1);

    const page = await load(d1, "");
    expect(page.tags.map((t) => t.tag)).toEqual(["Web", "日記"]);
    expect(page.tags.map((t) => t.count)).toEqual([2, 2]);
  });

  it("タグで絞り込む", async () => {
    const d1 = createTestD1();
    await seed(d1);

    const page = await load(d1, "?tag=Web");
    expect(page.notes.map((n) => n.slug)).toEqual(["alpha", "bravo"]);
    expect(page.tag).toBe("Web");
    // 索引は絞り込んでも全部出す (別のタグへ移れなくなるため)。
    expect(page.tags).toHaveLength(2);
  });

  it("検索語を受け取り、結果を 1 ページに収める", async () => {
    const d1 = createTestD1();
    await seed(d1);

    const page = await load(d1, "?q=alpha");
    expect(page.query).toBe("alpha");
    expect(page.notes.map((n) => n.slug)).toEqual(["alpha"]);
    /*
     * 検索は上限までを一度に返すので続きが無い。ページを分けてしまうと、続きを取る
     * API に検索語が渡らず無関係な記事が混ざる。
     */
    expect(page.pagination.totalPages).toBe(1);
  });

  it("検索語とタグを併用すると、検索結果をさらに絞る", async () => {
    const d1 = createTestD1();
    await seed(d1);

    const hit = await load(d1, "?q=summary&tag=日記");
    expect(
      hit.notes.map((n) => n.slug).toSorted((a, b) => a.localeCompare(b)),
    ).toEqual(["alpha", "charlie"]);
    expect(hit.query).toBe("summary");
    expect(hit.tag).toBe("日記");
  });

  it("空白だけの検索語は指定なしとして扱う", async () => {
    const d1 = createTestD1();
    await seed(d1);

    const page = await load(d1, "?q=%20%20");
    expect(page.query).toBe("");
    expect(page.notes).toHaveLength(3);
  });

  it("一致しない検索語では空になる", async () => {
    const d1 = createTestD1();
    await seed(d1);

    const page = await load(d1, "?q=zzzznotfound");
    expect(page.notes).toHaveLength(0);
    expect(page.pagination.total).toBe(0);
  });
});
