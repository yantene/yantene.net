import { EmbeddingGenerationError, EmbeddingVector } from "~/backend/domain/note-embedding";
import type { IEmbeddingGenerator } from "~/backend/domain/note-embedding";

/**
 * 既定のモデル。
 *
 * 記事が全部日本語なので、日本語向けに学習されたものを採る。2048 次元を出すため
 * Vectorize (1 ベクトル 1536 次元まで) には入らないが、57 本の全ペアを総当たりする
 * 構成なのでベクトルデータベースは使っていない。
 */
export const DEFAULT_EMBEDDING_MODEL = "@cf/pfnet/plamo-embedding-1b";

/**
 * このモデルが 1 度に受け取れる長さの目安 (文字数)。
 *
 * 上限は 4096 トークン。日本語は 1 文字が 1 トークンを超えることがあるので、
 * 文字数で余裕を持って切る。超える本文は呼ぶ側が分けて渡す。
 */
const MAX_INPUT_CHARACTERS = 3000;

/** 1 度の呼び出しで投げる本数。 */
const MAX_TEXTS_PER_CALL = 8;

/** Workers AI が返す埋め込みの形。data の中身は実行時に確かめる。 */
interface EmbeddingResponse {
  readonly data?: unknown;
  readonly shape?: unknown;
}

/**
 * Workers AI でベクトルを作る。
 *
 * ドメインの IEmbeddingGenerator を Cloudflare のバインディングで実装したもの。
 * 作れなかったときは EmbeddingGenerationError を送出する。空のベクトルやゼロベクトルで
 * 代用しない (静かに劣化させない)。
 */
export class WorkersAiEmbeddingGenerator implements IEmbeddingGenerator {
  readonly maxInputCharacters = MAX_INPUT_CHARACTERS;

  constructor(
    private readonly ai: Ai,
    readonly model: string = DEFAULT_EMBEDDING_MODEL,
  ) {}

  async embed(texts: readonly string[]): Promise<readonly EmbeddingVector[]> {
    const vectors: EmbeddingVector[] = [];
    for (let index = 0; index < texts.length; index += MAX_TEXTS_PER_CALL) {
      const batch = texts.slice(index, index + MAX_TEXTS_PER_CALL);
      vectors.push(...(await this.embedBatch(batch)));
    }
    return vectors;
  }

  private async embedBatch(texts: readonly string[]): Promise<readonly EmbeddingVector[]> {
    let response: EmbeddingResponse;
    try {
      response = (await this.ai.run(
        this.model as never,
        {
          text: [...texts],
        } as never,
      )) as EmbeddingResponse;
    } catch (error) {
      throw new EmbeddingGenerationError(
        `The embedding model ${this.model} could not be called: ${String(error)}`,
      );
    }

    const rows = response.data;
    if (!Array.isArray(rows)) {
      throw new EmbeddingGenerationError(
        `The embedding model ${this.model} returned no data array.`,
      );
    }
    /*
     * 本数が合わないまま通すと、ベクトルが別の記事に付く。順番で対応させている以上、
     * ここは数が合っていることを確かめてからでないと先へ進めない。
     */
    if (rows.length !== texts.length) {
      throw new EmbeddingGenerationError(
        `The embedding model ${this.model} returned ${rows.length.toString()} vector(s) for ${texts.length.toString()} input(s).`,
      );
    }

    return rows.map((row: unknown) => {
      if (!Array.isArray(row)) {
        throw new EmbeddingGenerationError(
          `The embedding model ${this.model} returned a non-array vector.`,
        );
      }
      // 中身の検証 (非有限・ゼロベクトル) は VO 側が受け持つ。
      return EmbeddingVector.create(row as number[]);
    });
  }
}
