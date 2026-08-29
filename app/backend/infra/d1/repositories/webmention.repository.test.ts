import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import { D1NoteCommandRepository } from "./note.command-repository";
import { D1WebmentionCommandRepository } from "./webmention.command-repository";
import { D1WebmentionQueryRepository } from "./webmention.query-repository";
import type { NoteId } from "~/backend/domain/note";
import { Note, NoteSlug, NoteTitle } from "~/backend/domain/note";
import {
  Webmention,
  WebmentionAuthor,
  WebmentionContent,
  WebmentionType,
  WebmentionUrl,
} from "~/backend/domain/webmention";
import { createTestD1 } from "~/backend/infra/d1/test-helper";

const SLUG = NoteSlug.create("alpha");
const SOURCE = WebmentionUrl.create("https://example.com/post/1");

interface Harness {
  readonly noteId: NoteId;
  readonly notes: D1NoteCommandRepository;
  readonly commands: D1WebmentionCommandRepository;
  readonly queries: D1WebmentionQueryRepository;
}

async function setup(): Promise<Harness> {
  const d1 = createTestD1();
  const notes = new D1NoteCommandRepository(d1);
  const note = await notes.upsert(
    Note.create({
      slug: SLUG,
      title: NoteTitle.create("Alpha"),
      summary: "summary",
      imageUrl: undefined,
      publishedOn: Temporal.PlainDate.from("2026-01-15"),
      lastModifiedOn: Temporal.PlainDate.from("2026-01-15"),
      sourceHash: "hash-0",
    }),
  );

  return {
    noteId: note.id,
    notes,
    commands: new D1WebmentionCommandRepository(d1),
    queries: new D1WebmentionQueryRepository(d1),
  };
}

function build(
  noteId: NoteId,
  overrides: {
    source?: WebmentionUrl;
    type?: WebmentionType;
    content?: WebmentionContent;
  } = {},
): ReturnType<typeof Webmention.create> {
  return Webmention.create({
    noteId,
    target: SLUG,
    source: overrides.source ?? SOURCE,
    type: overrides.type ?? WebmentionType.reply(),
    author: WebmentionAuthor.create({
      name: "Alice",
      url: WebmentionUrl.create("https://example.com/about"),
    }),
    content: overrides.content ?? WebmentionContent.fromText("いい記事だった"),
    publishedAt: Temporal.Instant.from("2026-08-01T01:00:00Z"),
  });
}

describe("D1WebmentionCommandRepository", () => {
  it("保存した内容を読み戻せる", async () => {
    const { noteId, commands, queries } = await setup();

    await commands.upsert(build(noteId));

    const [stored] = await queries.listByNoteId(noteId);
    expect(stored.source.toString()).toBe("https://example.com/post/1");
    expect(stored.target.toString()).toBe("alpha");
    expect(stored.type.toString()).toBe("reply");
    expect(stored.author.name).toBe("Alice");
    expect(stored.content?.toString()).toBe("いい記事だった");
    expect(stored.publishedAt?.toString()).toBe("2026-08-01T01:00:00Z");
  });

  /* Webmention は再送で更新される仕様。同じ送り元の行を重ねて積まない。 */
  it("同じ (ノート, source) は重ねず差し替える", async () => {
    const { noteId, commands, queries } = await setup();

    await commands.upsert(build(noteId));
    await commands.upsert(
      build(noteId, {
        type: WebmentionType.like(),
        content: WebmentionContent.fromText("やっぱりいいね"),
      }),
    );

    const stored = await queries.listByNoteId(noteId);
    expect(stored).toHaveLength(1);
    expect(stored[0].type.toString()).toBe("like");
    expect(stored[0].content?.toString()).toBe("やっぱりいいね");
  });

  /* 表示の並びが送り手の再送で入れ替わらないようにする。 */
  it("差し替えても最初に受け取った時刻は動かさない", async () => {
    const { noteId, commands, queries } = await setup();

    const first = await commands.upsert(build(noteId));
    const again = await commands.upsert(build(noteId, { type: WebmentionType.like() }));

    expect(again.receivedAt.epochMilliseconds).toBe(first.receivedAt.epochMilliseconds);
    const rows = await queries.listByNoteId(noteId);
    expect(rows[0].id).toBe(first.id);
  });

  it("送り元が違えば別の行になる", async () => {
    const { noteId, commands, queries } = await setup();

    await commands.upsert(build(noteId));
    await commands.upsert(
      build(noteId, {
        source: WebmentionUrl.create("https://other.example/x"),
      }),
    );

    expect(await queries.listByNoteId(noteId)).toHaveLength(2);
  });

  it("送り元を指して落とせる", async () => {
    const { noteId, commands, queries } = await setup();
    await commands.upsert(build(noteId));

    await commands.deleteBySource(noteId, SOURCE);

    expect(await queries.listByNoteId(noteId)).toEqual([]);
  });

  it("無い送り元を落としても壊れない", async () => {
    const { noteId, commands, queries } = await setup();

    await commands.deleteBySource(noteId, SOURCE);

    expect(await queries.listByNoteId(noteId)).toEqual([]);
  });

  /* D1 は FK 強制が既定で無効なので、ノート側でも明示的に掃除している。 */
  it("ノートを消すと受信済みの mention も消える", async () => {
    const { noteId, notes, commands, queries } = await setup();
    await commands.upsert(build(noteId));

    await notes.deleteBySlug(SLUG);

    expect(await queries.listByNoteId(noteId)).toEqual([]);
  });
});
