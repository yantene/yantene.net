import { EmbeddingGenerationError, EmbeddingVector } from "~/backend/domain/article-embedding";
import type { IEmbeddingGenerator } from "~/backend/domain/article-embedding";

/**
 * 既定のモデル。
 *
 * 多言語の qwen3-embedding-0.6b (1024 次元、一般提供)。人手で付けていたタグを物差しに
 * 4 モデルを測り直して選んだ。選定の経緯と他のモデルを落とした理由は ADR 0030 にある。
 */
export const DEFAULT_EMBEDDING_MODEL = "@cf/qwen/qwen3-embedding-0.6b";

/**
 * このモデルに 1 度に渡す長さの上限 (文字数)。
 *
 * qwen3 は 8,192 トークンから先を**黙って**切り捨てる。エラーにならないので、この上限は
 * モデルの仕様ではなく、後半が消えないように自分で置いた安全弁である。超えた分は呼ぶ側が
 * 分けて投げ、平均を取る。
 *
 * 8,192 トークンが何字にあたるかは本文の中身で変わる。密な日本語 (55 記事中いちばん
 * トークンが詰まる JOI の記事を繰り返した文章) で測ると、ベクトルが変わらなくなるのは
 * 11,500 字と 12,000 字の間。ASCII が半分混じる記事なら 16,000 字から 24,000 字の間まで入る。
 * 10,000 字は密なほうの下端 11,500 字に 0.85 を掛けて千字単位に丸めた値 (ADR 0031)。
 * 緩めるなら、切り捨てはログにも結果にも出ないことを踏まえること。
 */
const MAX_INPUT_CHARACTERS = 10_000;

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
