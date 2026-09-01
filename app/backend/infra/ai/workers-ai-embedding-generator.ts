import { EmbeddingGenerationError, EmbeddingVector } from "~/backend/domain/note-embedding";
import type { IEmbeddingGenerator } from "~/backend/domain/note-embedding";

/**
 * 既定のモデル。
 *
 * 日本語向けの `@cf/pfnet/plamo-embedding-1b` ではなく、多言語の bge-m3 を採る。
 * 手元の 55 本で 4 モデルを回して決めた (ADR 0028)。plamo は日本語特化にもかかわらず
 * 「どの記事の関連ノートにも出てこない記事」が 7 本残り (bge-m3 は 3 本)、そこに
 * 書いたばかりの最新記事が入っていた。加えて 2048 次元で保存が倍、値段が 1.6 倍、
 * Vectorize (1 ベクトル 1536 次元まで) にも入らない。
 */
export const DEFAULT_EMBEDDING_MODEL = "@cf/baai/bge-m3";

/**
 * このモデルが 1 度に受け取れる長さの目安 (文字数)。
 *
 * 上限は 60,000 トークンで、いまの記事は最長でも 7,229 字なので実際には分割されない。
 * それでも上限を置くのは、長い記事を書いたときに黙って切り捨てられないようにするため
 * (超えた分は呼ぶ側が分けて投げ、平均を取る)。モデルの選定もこの値で測っている。
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
