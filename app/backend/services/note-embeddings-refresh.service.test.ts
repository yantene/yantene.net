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
  /** replaceAllSimilarities に渡ってきたペアの列。書き直しごとに 1 要素増える。 */
  readonly rewritten: (readonly NoteSimilarity[])[];
}

function harness(options: {
  readonly slugs: readonly string[];
  readonly hashes: ReadonlyMap<string, string>;
  readonly stored?: readonly NoteEmbedding[];
  readonly generator?: IEmbeddingGenerator;
}): Harness {
  const upserted: NoteEmbedding[] = [];
  const rewritten: (readonly NoteSimilarity[])[] = [];

  const command: INoteEmbeddingCommandRepository = {
    upsert: async (embedding) => {
      upserted.push(embedding);
      return Promise.resolve();
    },
    replaceAllSimilarities: async (pairs) => {
      rewritten.push(pairs);
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
    rewritten,
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

  it("1 本足しただけでも、既存どうしを含む全ペアを書き直す", async () => {
    const stored: NoteEmbedding[] = [
      { slug: "beta", raw: [0, 1, 0] },
      { slug: "gamma", raw: [0, 0, 1] },
    ].map((item) => ({
      noteId: entityId<"Note">(`id-${item.slug}`),
      slug: NoteSlug.create(item.slug),
      model: MODEL,
      contentHash: "hash-old",
      vector: EmbeddingVector.create(item.raw),
    }));
    const { service, rewritten } = harness({
      slugs: ["alpha"],
      hashes: new Map([["alpha", "hash-1"]]),
      stored,
      generator: generatorReturning([[1, 0, 0]]),
    });

    const result = await service.sync(["alpha"]);

    /*
     * 中心化した類似度はコーパス全体の平均から出るので、alpha を足すと beta と gamma の
     * 間の値まで動く。1 記事ぶんだけ書き替えるのでは足りない。
     */
    expect(rewritten).toHaveLength(1);
    expect(result.rewrittenPairs).toBe(3);
    expect(rewritten[0]?.map((pair) => [pair.noteId, pair.otherNoteId])).toEqual([
      ["id-beta", "id-gamma"],
      ["id-beta", "id-alpha"],
      ["id-gamma", "id-alpha"],
    ]);
  });

  it("中心化してから比べる (素の内積のままにしない)", async () => {
    const { service, rewritten } = harness({
      slugs: ["alpha", "beta"],
      hashes: new Map([
        ["alpha", "hash-1"],
        ["beta", "hash-2"],
      ]),
      generator: generatorReturning([
        [1, 0, 0],
        [0, 1, 0],
      ]),
    });

    await service.sync(["alpha", "beta"]);

    /*
     * 直交する 2 本なので、素のままなら内積は 0。平均を引くと互いに逆を向くので -1 になる。
     * ここが 0 のままなら中心化が効いていない。
     */
    expect(rewritten[0]).toHaveLength(1);
    expect(rewritten[0]?.[0]?.similarity).toBeCloseTo(-1, 5);
  });

  it("作り直しの途中 (モデル差し替え直後) は書き直さない", async () => {
    // 古いモデルのまま残っている 1 本。今回の run では上限に掛からずとも揃わない。
    const stale: NoteEmbedding = {
      noteId: entityId<"Note">("id-beta"),
      slug: NoteSlug.create("beta"),
      model: "an-older-model",
      contentHash: "hash-old",
      vector: EmbeddingVector.create([0, 1, 0]),
    };
    const { service, rewritten } = harness({
      slugs: ["alpha"],
      hashes: new Map([["alpha", "hash-1"]]),
      stored: [stale],
      generator: generatorReturning([[1, 0, 0]]),
    });

    const result = await service.sync(["alpha"]);

    // 揃うまで書き直さない。潰すと beta の関連ノートが空になる。
    expect(rewritten).toHaveLength(0);
    expect(result.rewrittenPairs).toBe(0);
    expect(result.embedded).toEqual(["alpha"]);
  });

  it("書き直しが落ちても、記事の同期は通す", async () => {
    const { service } = harness({
      slugs: ["alpha", "beta"],
      hashes: new Map([
        ["alpha", "hash-1"],
        ["beta", "hash-2"],
      ]),
      // 本文が同じ 2 本。中心化するとゼロベクトルになって落ちる経路。
      generator: generatorReturning([[1, 0, 0]]),
    });

    const result = await service.sync(["alpha", "beta"]);

    expect(result.embedded).toEqual(["alpha", "beta"]);
    expect(result.rewrittenPairs).toBe(0);
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
