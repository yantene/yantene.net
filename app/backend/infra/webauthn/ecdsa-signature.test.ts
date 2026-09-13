import { describe, expect, it } from "vitest";
import {
  derToRawEcdsaSignature,
  DerSignatureError,
  P256_COORDINATE_BYTES,
} from "./ecdsa-signature";

/** 整数 1 つを DER の INTEGER にする (最小の長さ + 必要なら符号用の 0x00)。 */
function derInteger(value: Uint8Array): number[] {
  let start = 0;
  while (start < value.length - 1 && value[start] === 0) start += 1;
  const significant = [...value.subarray(start)];
  // 先頭のビットが立っていると負の数に読まれるので 0x00 を前置する。
  const content = (significant[0] ?? 0) >= 0x80 ? [0, ...significant] : significant;
  return [0x02, content.length, ...content];
}

/** raw の `r || s` を DER の SEQUENCE にする。 */
function rawToDer(raw: Uint8Array): Uint8Array {
  const half = raw.length / 2;
  const content = [...derInteger(raw.subarray(0, half)), ...derInteger(raw.subarray(half))];
  return new Uint8Array([0x30, content.length, ...content]);
}

/** 上位 `leadingZeros` バイトが 0 の座標を作る。 */
function coordinate(leadingZeros: number, fill = 0xab): Uint8Array {
  const value = new Uint8Array(P256_COORDINATE_BYTES).fill(fill);
  value.fill(0, 0, leadingZeros);
  return value;
}

describe("derToRawEcdsaSignature", () => {
  it("32 バイトの r / s をそのまま並べる", () => {
    const raw = new Uint8Array([...coordinate(0, 0x11), ...coordinate(0, 0x22)]);
    expect(derToRawEcdsaSignature(rawToDer(raw))).toEqual(raw);
  });

  it("符号用の 0x00 が前置された 33 バイトを落とす", () => {
    // 先頭が 0x80 以上なので DER では 0x00 が前置される。
    const raw = new Uint8Array([...coordinate(0, 0xff), ...coordinate(0, 0xff)]);
    const der = rawToDer(raw);
    expect(der.length).toBe(2 + 2 + 33 + 2 + 33);
    expect(derToRawEcdsaSignature(der)).toEqual(raw);
  });

  it("31 バイトに縮んだ r を左詰めで戻す", () => {
    // ここがライブラリ実装の取りこぼしどころ。約 1/256 の署名でこうなる。
    const raw = new Uint8Array([...coordinate(1, 0x7f), ...coordinate(0, 0x11)]);
    const der = rawToDer(raw);
    expect(der[3]).toBe(31);
    expect(derToRawEcdsaSignature(der)).toEqual(raw);
  });

  it("31 バイトに縮んだ s を左詰めで戻す", () => {
    const raw = new Uint8Array([...coordinate(0, 0x11), ...coordinate(1, 0x7f)]);
    expect(derToRawEcdsaSignature(rawToDer(raw))).toEqual(raw);
  });

  it("r も s も大きく縮んでいても戻せる", () => {
    const raw = new Uint8Array([...coordinate(20, 0x01), ...coordinate(31, 0x01)]);
    expect(derToRawEcdsaSignature(rawToDer(raw))).toEqual(raw);
  });

  it("どの縮み方でも往復する", () => {
    for (let rZeros = 0; rZeros < P256_COORDINATE_BYTES; rZeros += 1) {
      for (const sZeros of [0, 1, 7, 31]) {
        const raw = new Uint8Array([...coordinate(rZeros, 0x7f), ...coordinate(sZeros, 0x7f)]);
        expect(derToRawEcdsaSignature(rawToDer(raw))).toEqual(raw);
      }
    }
  });

  it("SEQUENCE でなければ送出する", () => {
    expect(() => derToRawEcdsaSignature(new Uint8Array([0x31, 0x00]))).toThrow(DerSignatureError);
  });

  it("INTEGER でなければ送出する", () => {
    expect(() => derToRawEcdsaSignature(new Uint8Array([0x30, 0x03, 0x04, 0x01, 0x00]))).toThrow(
      DerSignatureError,
    );
  });

  it("余りがあれば送出する", () => {
    const der = rawToDer(new Uint8Array([...coordinate(0), ...coordinate(0)]));
    expect(() => derToRawEcdsaSignature(new Uint8Array([...der, 0x00]))).toThrow(DerSignatureError);
  });

  it("曲線より広い整数は送出する", () => {
    // 33 バイトぶんの有効桁 (符号用の 0x00 ではない)。
    const wide = [0x02, 33, ...Array.from<number>({ length: 33 }).fill(0x11)];
    const der = new Uint8Array([0x30, wide.length * 2, ...wide, ...wide]);
    expect(() => derToRawEcdsaSignature(der)).toThrow(DerSignatureError);
  });

  it("途中で尽きる入力は送出する", () => {
    expect(() => derToRawEcdsaSignature(new Uint8Array([0x30, 0x10, 0x02, 0x01]))).toThrow(
      DerSignatureError,
    );
  });
});

describe("derToRawEcdsaSignature (Web Crypto と突き合わせる)", () => {
  it("DER に直した実際の署名が、戻すと検証を通る", async () => {
    const keyPair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, [
      "sign",
      "verify",
    ]);
    const data = new TextEncoder().encode("authenticatorData || sha256(clientDataJSON)");

    // Web Crypto の署名は raw。DER に包み直してから、実装で raw に戻す。
    for (let attempt = 0; attempt < 32; attempt += 1) {
      const raw = new Uint8Array(
        await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keyPair.privateKey, data),
      );
      const restored = derToRawEcdsaSignature(rawToDer(raw));
      expect(restored).toEqual(raw);
      expect(
        await crypto.subtle.verify(
          { name: "ECDSA", hash: "SHA-256" },
          keyPair.publicKey,
          restored,
          data,
        ),
      ).toBe(true);
    }
  });
});
