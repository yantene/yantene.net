import { EmbeddingGenerationError, EmbeddingVector } from "~/backend/domain/note-embedding";
import type { IEmbeddingGenerator } from "~/backend/domain/note-embedding";

/**
 * 既定のモデル。
 *
 * 多言語の qwen3-embedding-0.6b を採る (ADR 0030)。ADR 0028 では bge-m3 を、ハブと取り残しの
 * 少なさで選んでいたが、この 2 指標は並びの偏りしか見ておらず、でたらめに 6 件選ぶ推薦が
 * 最良になる。人手で付けていたタグを物差しに 4 モデルを測り直すと、bge-m3 はどの切り方でも
 * 最下位で、qwen3 と embeddinggemma-300m が上位に並んだ (差は 55 本では付かない)。
 * gemma は beta で料金表に無く 2,048 トークンで毎回分割になるので、一般提供で料金が載り、
 * 1024 次元のまま、55 本を切らずに読める qwen3 を採った。
 */
export const DEFAULT_EMBEDDING_MODEL = "@cf/qwen/qwen3-embedding-0.6b";

/**
 * このモデルに 1 度に渡す長さの上限 (文字数)。
 *
 * qwen3 は 8,192 トークン (日本語で 16,000 字と 24,000 字の間) から先を黙って切り捨てる。
 * エラーにならないので、呼ぶ側が字数で切って分けて投げ、平均を取る (ADR 0030 の実測)。
 * いまの記事は最長でも 7,229 字なので、実際には分割されない。モデルの選定もこの値で測っている。
 */
const MAX_INPUT_CHARACTERS = 8000;

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
