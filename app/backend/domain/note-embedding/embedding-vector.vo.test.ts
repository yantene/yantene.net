import { describe, expect, it } from "vitest";
import { EmbeddingVector } from "./embedding-vector.vo";
import { InvalidEmbeddingVectorError } from "./errors";

describe("EmbeddingVector", () => {
  it("normalizes on creation so that similarity is a plain dot product", () => {
    const vector = EmbeddingVector.create([3, 4]);
    // 長さ 5 のベクトルが単位長に落ちる。
    expect(vector.toJSON()[0]).toBeCloseTo(0.6, 6);
    expect(vector.toJSON()[1]).toBeCloseTo(0.8, 6);
    expect(vector.similarityTo(vector)).toBeCloseTo(1, 6);
  });

  it("scores parallel vectors alike no matter their original length", () => {
    const short = EmbeddingVector.create([1, 0]);
    const long = EmbeddingVector.create([100, 0]);
    expect(short.similarityTo(long)).toBeCloseTo(1, 6);
  });

  it("scores orthogonal vectors at zero and opposite ones at minus one", () => {
    const right = EmbeddingVector.create([1, 0]);
    const up = EmbeddingVector.create([0, 1]);
    const left = EmbeddingVector.create([-1, 0]);
    expect(right.similarityTo(up)).toBeCloseTo(0, 6);
    expect(right.similarityTo(left)).toBeCloseTo(-1, 6);
  });

  it("survives a round trip through the stored byte form", () => {
    const original = EmbeddingVector.create([0.1, -0.2, 0.3, 0.4]);
    const restored = EmbeddingVector.fromBytes(original.toBytes());
    expect(restored.equals(original)).toBe(true);
    expect(restored.dimensions).toBe(4);
  });

  it("reads a stored vector that does not start at a byte-aligned offset", () => {
    // D1 が返す BLOB は他の値と同じバッファに載っていることがある。ビューを直に
    // 張ると RangeError で落ちるので、写してから読む。
    const source = EmbeddingVector.create([1, 2, 3]).toBytes();
    const padded = new Uint8Array(source.byteLength + 1);
    padded.set(source, 1);
    const restored = EmbeddingVector.fromBytes(padded.subarray(1));
    expect(restored.dimensions).toBe(3);
  });

  it("averages vectors of a split article into one direction", () => {
    const first = EmbeddingVector.create([1, 0]);
    const second = EmbeddingVector.create([0, 1]);
    const mean = EmbeddingVector.mean([first, second]);
    expect(mean.similarityTo(first)).toBeCloseTo(Math.SQRT1_2, 6);
    expect(mean.similarityTo(second)).toBeCloseTo(Math.SQRT1_2, 6);
  });

  it("refuses the zero vector, which would look equally unrelated to everything", () => {
    expect(() => EmbeddingVector.create([0, 0, 0])).toThrow(InvalidEmbeddingVectorError);
  });

  it("refuses non-finite values and empty input", () => {
    expect(() => EmbeddingVector.create([1, Number.NaN])).toThrow(InvalidEmbeddingVectorError);
    expect(() => EmbeddingVector.create([])).toThrow(InvalidEmbeddingVectorError);
  });

  it("refuses to compare vectors of different dimensions", () => {
    const two = EmbeddingVector.create([1, 0]);
    const three = EmbeddingVector.create([1, 0, 0]);
    expect(() => two.similarityTo(three)).toThrow(InvalidEmbeddingVectorError);
    expect(() => EmbeddingVector.mean([two, three])).toThrow(InvalidEmbeddingVectorError);
  });

  it("refuses stored bytes that are not a whole number of float32 values", () => {
    expect(() => EmbeddingVector.fromBytes(new Uint8Array([1, 2, 3]))).toThrow(
      InvalidEmbeddingVectorError,
    );
  });
});
