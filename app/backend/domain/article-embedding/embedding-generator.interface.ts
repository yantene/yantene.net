import type { EmbeddingVector } from "./embedding-vector.vo";

/**
 * 文字列からベクトルを作るもの。
 *
 * ドメインはどのモデルがどこで動くかを知らない。infra が実装する。
 * `model` は保存して作り直しの判定に使うので、実装は自分が使っているモデルを
 * そのまま名乗ること。
 */
export interface IEmbeddingGenerator {
  readonly model: string;
  /** 1 度に受け取れる文字数の上限。これを超える本文は呼ぶ側が分けて渡す。 */
  readonly maxInputCharacters: number;
  /**
   * まとめてベクトルにする。返す順番は受け取った順番と同じにする。
   *
   * 作れなかったら EmbeddingGenerationError を送出する。空のベクトルや
   * ゼロベクトルで代用しない (fail-loud)。
   */
  embed(texts: readonly string[]): Promise<readonly EmbeddingVector[]>;
}
