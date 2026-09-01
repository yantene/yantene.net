import { InvalidEmbeddingVectorError } from "./errors";
import type { IValueObject } from "~/backend/domain/shared";

/**
 * 記事 1 本を表すベクトル。
 *
 * **生成した時点で L2 正規化して持つ。** そうするとコサイン類似度が内積だけになり、
 * 読むときも書くときもノルムを持ち歩かなくて済む。正規化を後段に任せると、片方だけ
 * 正規化されたベクトルが混ざったときに、類似度が静かに 1 を超える。
 *
 * 保存は float32 の並び (`toBytes`)。倍精度で持っても類似度の順位は変わらないのに、
 * 1 本あたりの大きさが 2 倍になる。
 */
export class EmbeddingVector implements IValueObject<EmbeddingVector> {
  private constructor(private readonly values: Float32Array) {}

  /** 生の数値列から作る。長さ 0・非有限・ゼロベクトルは受け取らない。 */
  static create(raw: readonly number[] | Float32Array): EmbeddingVector {
    if (raw.length === 0) {
      throw new InvalidEmbeddingVectorError("An embedding vector must not be empty.");
    }
    let sumOfSquares = 0;
    for (const value of raw) {
      if (!Number.isFinite(value)) {
        throw new InvalidEmbeddingVectorError(`An embedding vector must be finite: ${value}`);
      }
      sumOfSquares += value * value;
    }
    const norm = Math.sqrt(sumOfSquares);
    /*
     * ゼロベクトルを弾く。向きが無いので、どの記事との類似度も 0 になる。
     * 静かに通すと「どれとも似ていない記事」として関連ノートから消え、原因が
     * 表に出ない (fail-loud)。
     */
    if (norm === 0) {
      throw new InvalidEmbeddingVectorError("An embedding vector must not be the zero vector.");
    }
    const normalized = new Float32Array(raw.length);
    for (const [index, value] of [...raw].entries()) normalized[index] = value / norm;
    return new EmbeddingVector(normalized);
  }

  /** 保存した float32 の並びから戻す。長さが 4 の倍数でなければ受け取らない。 */
  static fromBytes(bytes: Uint8Array): EmbeddingVector {
    if (bytes.byteLength % Float32Array.BYTES_PER_ELEMENT !== 0) {
      throw new InvalidEmbeddingVectorError(
        `A stored embedding must be a whole number of float32 values: ${bytes.byteLength.toString()} bytes`,
      );
    }
    /*
     * バイト境界が揃っている保証が無いので、Float32Array のビューを直に張らずに写す。
     * D1 が返す BLOB は他の値と同じバッファに載っていることがあり、そのときビューは
     * RangeError で落ちる。
     */
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return EmbeddingVector.create(new Float32Array(copy.buffer));
  }

  /**
   * 複数のベクトルの平均を取って 1 本にする。
   *
   * モデルに入る長さを超える記事を分けて投げたときに使う。次元の違うものは混ぜない。
   */
  static mean(vectors: readonly EmbeddingVector[]): EmbeddingVector {
    const [head] = vectors;
    if (head === undefined) {
      throw new InvalidEmbeddingVectorError("Cannot average an empty list of vectors.");
    }
    if (vectors.some((vector) => vector.dimensions !== head.dimensions)) {
      throw new InvalidEmbeddingVectorError("Cannot average vectors of different dimensions.");
    }
    const summed = new Float32Array(head.dimensions);
    for (const vector of vectors) {
      for (let index = 0; index < summed.length; index++) {
        summed[index] = (summed[index] ?? 0) + (vector.values[index] ?? 0);
      }
    }
    // create が正規化するので、ここで件数で割る必要はない。
    return EmbeddingVector.create(summed);
  }

  /**
   * コーパス全体の平均を引いてから正規化し直す (中心化)。
   *
   * 素のベクトルは全体が同じ向きに寄っている。そのせいで特定の 1 本がどの記事の上位にも
   * 居座る一方 (ハブ)、どこからも出てこない記事が残る。平均を引くと記事どうしの差だけが
   * 残り、実測ではハブが 23 回から 10 回に減り、どこからも出てこない記事が 3 本から
   * 0 本になった (ADR 0028)。
   *
   * **平均は記事が増えるたびに動く。** 一部の記事だけ中心化し直すと、違う平均で引いた値が
   * 同じ表に並んで比べられなくなる。呼ぶ側は必ず全ペアをまとめて計算し直すこと。
   *
   * 1 本しか無いときは中心化しない (引くと必ずゼロベクトルになる)。比べる相手が
   * 居ないので、そのまま返して困らない。
   */
  static centerAll(vectors: readonly EmbeddingVector[]): readonly EmbeddingVector[] {
    const [head] = vectors;
    if (head === undefined || vectors.length < 2) return vectors;
    if (vectors.some((vector) => vector.dimensions !== head.dimensions)) {
      throw new InvalidEmbeddingVectorError("Cannot center vectors of different dimensions.");
    }
    const centroid = new Float32Array(head.dimensions);
    for (const vector of vectors) {
      for (let index = 0; index < centroid.length; index++) {
        centroid[index] = (centroid[index] ?? 0) + (vector.values[index] ?? 0) / vectors.length;
      }
    }
    // create が正規化まで済ませる。
    return vectors.map((vector) =>
      EmbeddingVector.create(vector.values.map((value, index) => value - (centroid[index] ?? 0))),
    );
  }

  get dimensions(): number {
    return this.values.length;
  }

  /**
   * コサイン類似度。両方とも正規化済みなので内積で足りる。
   *
   * 次元が違うベクトルは比べない。モデルを差し替えた直後に古い行が残っていると
   * ここに来るので、0 を返さずに落とす (関連ノートが静かに空になるより、refresh が
   * 落ちて気づけるほうがよい)。
   */
  similarityTo(other: EmbeddingVector): number {
    if (this.dimensions !== other.dimensions) {
      throw new InvalidEmbeddingVectorError(
        `Cannot compare vectors of different dimensions: ${this.dimensions.toString()} and ${other.dimensions.toString()}`,
      );
    }
    let dot = 0;
    for (let index = 0; index < this.values.length; index++) {
      dot += (this.values[index] ?? 0) * (other.values[index] ?? 0);
    }
    // 丸めで 1 をわずかに超えることがある。順位は変わらないが、値をそのまま出す
    // ところがあるので閉区間に収めておく。
    return Math.min(1, Math.max(-1, dot));
  }

  toBytes(): Uint8Array {
    return new Uint8Array(this.values.buffer.slice(0));
  }

  equals(other: EmbeddingVector): boolean {
    if (this.dimensions !== other.dimensions) return false;
    return this.values.every((value, index) => value === other.values[index]);
  }

  toJSON(): number[] {
    return [...this.values];
  }
}
