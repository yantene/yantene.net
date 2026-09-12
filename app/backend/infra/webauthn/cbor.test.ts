import { describe, expect, it } from "vitest";
import { CborDecodeError, decodeCbor, decodeCborExact } from "./cbor";

const bytes = (...values: number[]): Uint8Array => new Uint8Array(values);

describe("decodeCborExact", () => {
  it("小さな符号なし整数を読む", () => {
    expect(decodeCborExact(bytes(0x00))).toBe(0);
    expect(decodeCborExact(bytes(0x17))).toBe(23);
  });

  it("幅のある符号なし整数を読む", () => {
    expect(decodeCborExact(bytes(0x18, 0x18))).toBe(24);
    expect(decodeCborExact(bytes(0x19, 0x01, 0x00))).toBe(256);
    expect(decodeCborExact(bytes(0x1a, 0x00, 0x01, 0x00, 0x00))).toBe(65_536);
  });

  it("負の整数を読む", () => {
    expect(decodeCborExact(bytes(0x20))).toBe(-1);
    expect(decodeCborExact(bytes(0x37))).toBe(-24);
    expect(decodeCborExact(bytes(0x38, 0x18))).toBe(-25);
    // COSE の EC2 公開鍵が使う -7 (alg) / -1 (crv) / -2 (x) / -3 (y)。
    expect(decodeCborExact(bytes(0x26))).toBe(-7);
  });

  it("バイト列と文字列を読む", () => {
    expect(decodeCborExact(bytes(0x43, 1, 2, 3))).toEqual(bytes(1, 2, 3));
    expect(decodeCborExact(bytes(0x64, 0x6e, 0x6f, 0x6e, 0x65))).toBe("none");
  });

  it("配列と map を読む", () => {
    expect(decodeCborExact(bytes(0x83, 0x01, 0x02, 0x03))).toEqual([1, 2, 3]);
    expect(decodeCborExact(bytes(0xa1, 0x01, 0x02))).toEqual(new Map([[1, 2]]));
  });

  it("attestation object の形を読む", () => {
    // { "fmt": "none", "attStmt": {}, "authData": h'0102' }
    const attestation = bytes(
      0xa3,
      0x63,
      0x66,
      0x6d,
      0x74, // "fmt"
      0x64,
      0x6e,
      0x6f,
      0x6e,
      0x65, // "none"
      0x67,
      0x61,
      0x74,
      0x74,
      0x53,
      0x74,
      0x6d,
      0x74, // "attStmt"
      0xa0, // {}
      0x68,
      0x61,
      0x75,
      0x74,
      0x68,
      0x44,
      0x61,
      0x74,
      0x61, // "authData"
      0x42,
      0x01,
      0x02, // h'0102'
    );
    const decoded = decodeCborExact(attestation) as ReadonlyMap<string, unknown>;
    expect(decoded.get("fmt")).toBe("none");
    expect(decoded.get("attStmt")).toEqual(new Map());
    expect(decoded.get("authData")).toEqual(bytes(0x01, 0x02));
  });

  it("true / false / null を読む", () => {
    expect(decodeCborExact(bytes(0xf4))).toBe(false);
    expect(decodeCborExact(bytes(0xf5))).toBe(true);
    expect(decodeCborExact(bytes(0xf6))).toBe(null);
  });

  it("余りがあれば送出する", () => {
    expect(() => decodeCborExact(bytes(0x01, 0x02))).toThrow(CborDecodeError);
  });

  it("不定長は読まない", () => {
    expect(() => decodeCborExact(bytes(0x5f, 0x41, 0x01, 0xff))).toThrow(CborDecodeError);
  });

  it("タグは読まない", () => {
    expect(() => decodeCborExact(bytes(0xc0, 0x01))).toThrow(CborDecodeError);
  });

  it("浮動小数は読まない", () => {
    expect(() => decodeCborExact(bytes(0xf9, 0x00, 0x00))).toThrow(CborDecodeError);
  });

  it("予約された additional information は読まない", () => {
    expect(() => decodeCborExact(bytes(0x1c))).toThrow(CborDecodeError);
  });

  it("同じ鍵が 2 度出たら送出する", () => {
    expect(() => decodeCborExact(bytes(0xa2, 0x01, 0x02, 0x01, 0x03))).toThrow(CborDecodeError);
  });

  it("入力が途中で尽きたら送出する", () => {
    expect(() => decodeCborExact(bytes(0x43, 1, 2))).toThrow(CborDecodeError);
    expect(() => decodeCborExact(bytes(0x19, 0x01))).toThrow(CborDecodeError);
  });

  it("正確に表せない大きさの整数は送出する", () => {
    expect(() =>
      decodeCborExact(bytes(0x1b, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff)),
    ).toThrow(CborDecodeError);
  });

  it("深く入れ子にした入力は送出する (スタックを溢れさせない)", () => {
    const deep = new Uint8Array(1000).fill(0x81);
    expect(() => decodeCborExact(deep)).toThrow(CborDecodeError);
  });
});

describe("decodeCbor", () => {
  it("読み終えた位置を返す (COSE 鍵の切り出しに使う)", () => {
    // map 1 つのあとに余りを置く。余りは読まない。
    const input = bytes(0xa1, 0x01, 0x02, 0xde, 0xad);
    const { value, end } = decodeCbor(input);
    expect(value).toEqual(new Map([[1, 2]]));
    expect(end).toBe(3);
  });

  it("途中の位置から読める", () => {
    expect(decodeCbor(bytes(0xff, 0x01), 1).value).toBe(1);
  });
});
