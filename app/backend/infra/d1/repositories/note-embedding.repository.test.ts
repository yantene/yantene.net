import { Temporal } from "@js-temporal/polyfill";
import { beforeEach, describe, expect, it } from "vitest";
import { D1NoteEmbeddingCommandRepository } from "./note-embedding.command-repository";
import { D1NoteEmbeddingQueryRepository } from "./note-embedding.query-repository";
import { D1NoteCommandRepository } from "./note.command-repository";
import { D1NoteQueryRepository } from "./note.query-repository";
import type { NoteEmbedding } from "~/backend/domain/note-embedding";
import type { EntityId } from "~/backend/domain/shared";
import { Note, NoteSlug, NoteTitle } from "~/backend/domain/note";
import { EmbeddingVector } from "~/backend/domain/note-embedding";
import { createTestD1 } from "~/backend/infra/d1/test-helper";

const MODEL = "@cf/pfnet/plamo-embedding-1b";

/** 記事を 1 本入れて、採番された id を返す。近さの行は外部キーで実在する記事を要求する。 */
async function seedNote(d1: D1Database, slug: string): Promise<EntityId<"Note">> {
  await new D1NoteCommandRepository(d1).upsert(
    Note.create({
      slug: NoteSlug.create(slug),
      title: NoteTitle.create(slug),
      summary: "s",
      publishedOn: Temporal.PlainDate.from("2026-01-01"),
      lastModifiedOn: Temporal.PlainDate.from("2026-01-01"),
      sourceHash: `hash-${slug}`,
    }),
  );
  const note = await new D1NoteQueryRepository(d1).findBySlug(NoteSlug.create(slug));
  if (note?.id === undefined) throw new Error(`failed to seed ${slug}`);
  return note.id;
}

function embedding(
  noteId: EntityId<"Note">,
  slug: string,
  values: readonly number[],
): NoteEmbedding {
  return {
    noteId,
    slug: NoteSlug.create(slug),
    model: MODEL,
    contentHash: `hash-${slug}`,
    vector: EmbeddingVector.create(values),
  };
}

describe("D1NoteEmbedding リポジトリ", () => {
  let d1: D1Database;
  let command: D1NoteEmbeddingCommandRepository;
  let query: D1NoteEmbeddingQueryRepository;

  beforeEach(() => {
    d1 = createTestD1();
    command = new D1NoteEmbeddingCommandRepository(d1);
    query = new D1NoteEmbeddingQueryRepository(d1);
  });

  it("書いたベクトルを読み戻せる (BLOB の往復)", async () => {
    const id = await seedNote(d1, "a");
    const written = embedding(id, "a", [3, 4]);
    await command.upsert(written);

    const [read] = await query.listAll();
    expect(read.slug.toString()).toBe("a");
    expect(read.model).toBe(MODEL);
    expect(read.contentHash).toBe("hash-a");
    // 保存も読み出しも正規化済みの float32 なので、ビット単位で一致する。
    expect(read.vector.equals(written.vector)).toBe(true);
    // 値そのものも見る。equals だけだと、両方が同じように壊れていても通ってしまう。
    expect(read.vector.dimensions).toBe(2);
    expect(read.vector.toJSON()[0]).toBeCloseTo(0.6, 6);
    expect(read.vector.toJSON()[1]).toBeCloseTo(0.8, 6);
  });

  it("同じノートに 2 度書くと置き換わる", async () => {
    const id = await seedNote(d1, "a");
    await command.upsert(embedding(id, "a", [1, 0]));
    await command.upsert(embedding(id, "a", [0, 1]));

    const all = await query.listAll();
    expect(all).toHaveLength(1);
    expect(all[0].vector.toJSON()).toEqual([0, 1]);
    expect(all[0].vector.dimensions).toBe(2);
  });

  it("近さは両方向に書かれる", async () => {
    const a = await seedNote(d1, "a");
    const b = await seedNote(d1, "b");
    await command.upsert(embedding(a, "a", [1, 0]));
    await command.upsert(embedding(b, "b", [1, 0]));

    await command.replaceAllSimilarities([{ noteId: a, otherNoteId: b, similarity: 0.9 }]);

    expect(await query.findRelatedSlugs(NoteSlug.create("a"), 6)).toEqual(["b"]);
    // 片方向だけだと、後から書いた記事が古い記事の関連ノートに出てこない。
    expect(await query.findRelatedSlugs(NoteSlug.create("b"), 6)).toEqual(["a"]);
  });

  it("近い順に返し、limit で切る", async () => {
    const a = await seedNote(d1, "a");
    const near = await seedNote(d1, "near");
    const mid = await seedNote(d1, "mid");
    const far = await seedNote(d1, "far");
    await command.replaceAllSimilarities([
      { noteId: a, otherNoteId: far, similarity: 0.1 },
      { noteId: a, otherNoteId: near, similarity: 0.9 },
      { noteId: a, otherNoteId: mid, similarity: 0.5 },
    ]);

    expect(await query.findRelatedSlugs(NoteSlug.create("a"), 6)).toEqual(["near", "mid", "far"]);
    expect(await query.findRelatedSlugs(NoteSlug.create("a"), 2)).toEqual(["near", "mid"]);
  });

  it("同点は slug の昇順で決まる (実行ごとに揺れない)", async () => {
    const a = await seedNote(d1, "a");
    const x = await seedNote(d1, "x");
    const y = await seedNote(d1, "y");
    const z = await seedNote(d1, "z");
    await command.replaceAllSimilarities([
      { noteId: a, otherNoteId: z, similarity: 0.5 },
      { noteId: a, otherNoteId: y, similarity: 0.5 },
      { noteId: a, otherNoteId: x, similarity: 0.5 },
    ]);

    expect(await query.findRelatedSlugs(NoteSlug.create("a"), 6)).toEqual(["x", "y", "z"]);
  });

  it("入れ替えると、古い行は両方向とも残らない", async () => {
    const a = await seedNote(d1, "a");
    const old = await seedNote(d1, "old");
    const fresh = await seedNote(d1, "fresh");
    await command.replaceAllSimilarities([{ noteId: a, otherNoteId: old, similarity: 0.9 }]);

    await command.replaceAllSimilarities([{ noteId: a, otherNoteId: fresh, similarity: 0.8 }]);

    expect(await query.findRelatedSlugs(NoteSlug.create("a"), 6)).toEqual(["fresh"]);
    // 逆向きの行も消えていること。消し漏らすと old の関連ノートに a が残り続ける。
    expect(await query.findRelatedSlugs(NoteSlug.create("old"), 6)).toEqual([]);
  });

  it("バインドパラメータの上限を越える件数でも書ける", async () => {
    const a = await seedNote(d1, "a");
    // 1 文 30 行で切って batch に積むので、2 文以上に分かれる数を渡す (20 ペア = 両方向 40 行)。
    const others = [];
    for (let index = 0; index < 20; index++) {
      others.push(await seedNote(d1, `n${index.toString().padStart(2, "0")}`));
    }

    await command.replaceAllSimilarities(
      others.map((otherNoteId, index) => ({ noteId: a, otherNoteId, similarity: index / 100 })),
    );

    const related = await query.findRelatedSlugs(NoteSlug.create("a"), 100);
    expect(related).toHaveLength(20);
    expect(related[0]).toBe("n19");
  });

  it("記事が消えたあと、残った行を掃除できる", async () => {
    const a = await seedNote(d1, "a");
    const b = await seedNote(d1, "b");
    await command.upsert(embedding(a, "a", [1, 0]));
    await command.upsert(embedding(b, "b", [0, 1]));
    await command.replaceAllSimilarities([{ noteId: a, otherNoteId: b, similarity: 0.9 }]);

    // ノートの同期が先に記事を消す。こちらから slug を辿ることはもうできない。
    await d1.prepare("DELETE FROM notes WHERE slug = ?").bind("a").run();
    await command.deleteOrphans();

    expect((await query.listAll()).map((item) => item.slug.toString())).toEqual(["b"]);
    expect(await query.findRelatedSlugs(NoteSlug.create("b"), 6)).toEqual([]);
  });

  it("消えた記事が無ければ、掃除しても何も減らない", async () => {
    const a = await seedNote(d1, "a");
    const b = await seedNote(d1, "b");
    await command.upsert(embedding(a, "a", [1, 0]));
    await command.upsert(embedding(b, "b", [0, 1]));
    await command.replaceAllSimilarities([{ noteId: a, otherNoteId: b, similarity: 0.9 }]);

    await command.deleteOrphans();

    expect(await query.listAll()).toHaveLength(2);
    expect(await query.findRelatedSlugs(NoteSlug.create("a"), 6)).toEqual(["b"]);
  });

  it("ベクトルが 1 本も無ければ空を返す", async () => {
    expect(await query.listAll()).toEqual([]);
    expect(await query.findRelatedSlugs(NoteSlug.create("nope"), 6)).toEqual([]);
  });
});
