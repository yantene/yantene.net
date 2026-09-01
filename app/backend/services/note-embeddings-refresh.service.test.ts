import { describe, expect, it, vi } from "vitest";
import { NoteEmbeddingsRefreshService } from "./note-embeddings-refresh.service";
import type { Root } from "mdast";
import type { INoteContentCache, INoteQueryRepository, Note } from "~/backend/domain/note";
import type {
  IEmbeddingGenerator,
  INoteEmbeddingCommandRepository,
  INoteEmbeddingQueryRepository,
  NoteEmbedding,
  NoteSimilarity,
} from "~/backend/domain/note-embedding";
import type { ILogger } from "~/backend/domain/shared";
import { NoteSlug } from "~/backend/domain/note";
import { EmbeddingGenerationError, EmbeddingVector } from "~/backend/domain/note-embedding";
import { entityId } from "~/backend/domain/shared";

const MODEL = "test-model";

function silentLogger(): ILogger {
  const logger: ILogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => logger,
  };
  return logger;
}

function noteOf(slug: string): Note {
  return {
    id: entityId<"Note">(`id-${slug}`),
    slug: NoteSlug.create(slug),
    title: { toString: () => `題 ${slug}` },
  } as unknown as Note;
}

function bodyOf(value: string): Root {
  return { type: "root", children: [{ type: "paragraph", children: [{ type: "text", value }] }] };
}

/** 決まったベクトルを返す生成器。テキストの中身では変えない。 */
function generatorReturning(vectors: readonly number[][]): IEmbeddingGenerator {
  let call = 0;
  return {
    model: MODEL,
    maxInputCharacters: 1000,
    embed: vi.fn(async () => {
      const raw = vectors[Math.min(call, vectors.length - 1)] ?? [1, 0];
      call += 1;
      return Promise.resolve([EmbeddingVector.create(raw)]);
    }),
  };
}

interface Harness {
  readonly service: NoteEmbeddingsRefreshService;
  readonly upserted: NoteEmbedding[];
  readonly replaced: { noteId: string; rows: readonly NoteSimilarity[] }[];
}

function harness(options: {
  readonly slugs: readonly string[];
  readonly hashes: ReadonlyMap<string, string>;
  readonly stored?: readonly NoteEmbedding[];
  readonly generator?: IEmbeddingGenerator;
}): Harness {
  const upserted: NoteEmbedding[] = [];
  const replaced: { noteId: string; rows: readonly NoteSimilarity[] }[] = [];

  const command: INoteEmbeddingCommandRepository = {
    upsert: async (embedding) => {
      upserted.push(embedding);
      return Promise.resolve();
    },
    replaceSimilarities: async (noteId, rows) => {
      replaced.push({ noteId, rows });
      return Promise.resolve();
    },
    deleteBySlug: vi.fn(async () => Promise.resolve()),
  };

  const query: INoteEmbeddingQueryRepository = {
    listAll: async () => Promise.resolve(options.stored ?? []),
    findRelatedSlugs: vi.fn(async () => Promise.resolve([])),
  };

  const notes = {
    findBySlug: async (slug: NoteSlug) =>
      Promise.resolve(
        options.slugs.includes(slug.toString()) ? noteOf(slug.toString()) : undefined,
      ),
    listSourceHashes: async () => Promise.resolve(options.hashes),
  } as unknown as INoteQueryRepository;

  const cache = {
    getMdast: async () => Promise.resolve(bodyOf("本文")),
  } as unknown as INoteContentCache;

  return {
    service: new NoteEmbeddingsRefreshService(
      options.generator ?? generatorReturning([[1, 0]]),
      command,
      query,
      notes,
      cache,
      silentLogger(),
    ),
    upserted,
    replaced,
  };
}

describe("NoteEmbeddingsRefreshService", () => {
  it("embeds a note that has no vector yet", async () => {
    const { service, upserted } = harness({
      slugs: ["alpha"],
      hashes: new Map([["alpha", "hash-1"]]),
    });

    const result = await service.sync(["alpha"]);

    expect(result.embedded).toEqual(["alpha"]);
    expect(upserted).toHaveLength(1);
    expect(upserted[0]?.model).toBe(MODEL);
    expect(upserted[0]?.contentHash).toBe("hash-1");
  });

  it("skips a note whose body and model are both unchanged", async () => {
    const stored: NoteEmbedding = {
      noteId: entityId<"Note">("id-alpha"),
      slug: NoteSlug.create("alpha"),
      model: MODEL,
      contentHash: "hash-1",
      vector: EmbeddingVector.create([1, 0]),
    };
    const { service, upserted } = harness({
      slugs: ["alpha"],
      hashes: new Map([["alpha", "hash-1"]]),
      stored: [stored],
    });

    const result = await service.sync(["alpha"]);

    expect(result.unchanged).toEqual(["alpha"]);
    expect(upserted).toHaveLength(0);
  });

  it("re-embeds when the model changed even though the body did not", async () => {
    const stored: NoteEmbedding = {
      noteId: entityId<"Note">("id-alpha"),
      slug: NoteSlug.create("alpha"),
      model: "an-older-model",
      contentHash: "hash-1",
      vector: EmbeddingVector.create([1, 0]),
    };
    const { service, upserted } = harness({
      slugs: ["alpha"],
      hashes: new Map([["alpha", "hash-1"]]),
      stored: [stored],
    });

    await service.sync(["alpha"]);

    expect(upserted).toHaveLength(1);
  });

  it("pairs a new note with every note already stored", async () => {
    const stored: NoteEmbedding[] = ["beta", "gamma"].map((slug) => ({
      noteId: entityId<"Note">(`id-${slug}`),
      slug: NoteSlug.create(slug),
      model: MODEL,
      contentHash: "hash-old",
      vector: EmbeddingVector.create([1, 0]),
    }));
    const { service, replaced } = harness({
      slugs: ["alpha"],
      hashes: new Map([["alpha", "hash-1"]]),
      stored,
    });

    await service.sync(["alpha"]);

    // 古い 2 本ぶんの行が、新しい記事の側から書かれる。両方向にするのは
    // リポジトリの役目なので、ここではペアが揃っていることだけを見る。
    expect(replaced).toHaveLength(1);
    expect(replaced[0]?.rows.map((row) => row.otherNoteId)).toEqual(["id-beta", "id-gamma"]);
  });

  it("pairs notes embedded in the same run with each other", async () => {
    const { service, replaced } = harness({
      slugs: ["alpha", "beta"],
      hashes: new Map([
        ["alpha", "hash-1"],
        ["beta", "hash-2"],
      ]),
    });

    await service.sync(["alpha", "beta"]);

    // alpha は相手がいないので 0 行、beta は alpha との 1 行。
    expect(replaced[0]?.rows).toHaveLength(0);
    expect(replaced[1]?.rows.map((row) => row.otherNoteId)).toEqual(["id-alpha"]);
  });

  it("records a failure without stopping the run, leaving the old vector in place", async () => {
    const failing: IEmbeddingGenerator = {
      model: MODEL,
      maxInputCharacters: 1000,
      embed: async () => {
        await Promise.resolve();
        throw new EmbeddingGenerationError("the model is unreachable");
      },
    };
    const { service, upserted } = harness({
      slugs: ["alpha", "beta"],
      hashes: new Map([
        ["alpha", "hash-1"],
        ["beta", "hash-2"],
      ]),
      generator: failing,
    });

    const result = await service.sync(["alpha", "beta"]);

    expect(result.failed).toEqual(["alpha", "beta"]);
    expect(result.embedded).toEqual([]);
    expect(upserted).toHaveLength(0);
  });
});
