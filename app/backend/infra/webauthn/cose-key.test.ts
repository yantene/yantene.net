import { describe, expect, it } from "vitest";
import { CoseKeyError, importCoseKey, sliceCoseKey } from "./cose-key";
import { concat, encodeCbor, es256CoseKey, rs256CoseKey } from "./test-helper";

async function generateEs256Jwk(): Promise<JsonWebKey> {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);
  return crypto.subtle.exportKey("jwk", pair.publicKey);
}

async function generateRs256Jwk(): Promise<JsonWebKey> {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  return crypto.subtle.exportKey("jwk", pair.publicKey);
}

describe("importCoseKey", () => {
  it("ES256 の鍵を取り込み、その鍵で署名を検証できる", async () => {
    const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
      "sign",
      "verify",
    ]);
    const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
    const { algorithm, key } = await importCoseKey(es256CoseKey(jwk));

    expect(algorithm).toBe("ES256");
    expect(key.usages).toEqual(["verify"]);
    expect(key.extractable).toBe(false);

    const data = new TextEncoder().encode("signed");
    const signature = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      pair.privateKey,
      data,
    );
    expect(
      await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, signature, data),
    ).toBe(true);
  });

  it("RS256 の鍵を取り込み、その鍵で署名を検証できる", async () => {
    const pair = await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"],
    );
    const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
    const { algorithm, key } = await importCoseKey(rs256CoseKey(jwk));

    expect(algorithm).toBe("RS256");
    const data = new TextEncoder().encode("signed");
    const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, data);
    expect(await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, data)).toBe(true);
  });

  it("詰め物の付いた座標でも取り込める", async () => {
    const jwk = await generateEs256Jwk();
    const key = new Map<number, unknown>([
      [1, 2],
      [3, -7],
      [-1, 1],
      // 先頭に 0 を足しても値は変わらない。
      [-2, concat(new Uint8Array([0]), fromB64(jwk.x ?? ""))],
      [-3, fromB64(jwk.y ?? "")],
    ]);
    await expect(importCoseKey(encodeCbor(key))).resolves.toMatchObject({ algorithm: "ES256" });
  });

  it("申告していない算法は送出する", async () => {
    // EdDSA (-8)。pubKeyCredParams に載せていないので来るはずがない。
    const key = encodeCbor(
      new Map<number, unknown>([
        [1, 1],
        [3, -8],
        [-1, 6],
        [-2, new Uint8Array(32)],
      ]),
    );
    await expect(importCoseKey(key)).rejects.toThrow(CoseKeyError);
  });

  it("算法と鍵の種類が食い違えば送出する", async () => {
    const jwk = await generateEs256Jwk();
    const key = new Map<number, unknown>([
      [1, 3], // RSA と名乗る
      [3, -7], // のに ES256
      [-1, 1],
      [-2, fromB64(jwk.x ?? "")],
      [-3, fromB64(jwk.y ?? "")],
    ]);
    await expect(importCoseKey(encodeCbor(key))).rejects.toThrow(CoseKeyError);
  });

  it("P-256 でない曲線は送出する", async () => {
    const jwk = await generateEs256Jwk();
    const key = new Map<number, unknown>([
      [1, 2],
      [3, -7],
      [-1, 2], // P-384
      [-2, fromB64(jwk.x ?? "")],
      [-3, fromB64(jwk.y ?? "")],
    ]);
    await expect(importCoseKey(encodeCbor(key))).rejects.toThrow(CoseKeyError);
  });

  it("座標が欠けていれば送出する", async () => {
    const key = encodeCbor(
      new Map<number, unknown>([
        [1, 2],
        [3, -7],
        [-1, 1],
        [-2, new Uint8Array(32)],
      ]),
    );
    await expect(importCoseKey(key)).rejects.toThrow(CoseKeyError);
  });

  it("曲線より広い座標は送出する", async () => {
    const key = encodeCbor(
      new Map<number, unknown>([
        [1, 2],
        [3, -7],
        [-1, 1],
        [-2, new Uint8Array(33).fill(0x11)],
        [-3, new Uint8Array(32).fill(0x22)],
      ]),
    );
    await expect(importCoseKey(key)).rejects.toThrow(CoseKeyError);
  });

  it("map でなければ送出する", async () => {
    await expect(importCoseKey(encodeCbor(1))).rejects.toThrow(CoseKeyError);
  });

  it("余りがあれば送出する", async () => {
    const jwk = await generateEs256Jwk();
    await expect(importCoseKey(concat(es256CoseKey(jwk), new Uint8Array([0xde])))).rejects.toThrow(
      CoseKeyError,
    );
  });

  it("RSA の鍵も詰め物の有無で変わらない", async () => {
    const jwk = await generateRs256Jwk();
    await expect(importCoseKey(rs256CoseKey(jwk))).resolves.toMatchObject({ algorithm: "RS256" });
  });
});

describe("sliceCoseKey", () => {
  it("後ろに拡張が続いていても鍵だけを取り出す", async () => {
    const jwk = await generateEs256Jwk();
    const key = es256CoseKey(jwk);
    const extensions = encodeCbor(new Map<string, unknown>([["credProtect", 2]]));
    const combined = concat(new Uint8Array([0xaa, 0xbb]), key, extensions);

    expect(sliceCoseKey(combined, 2)).toEqual(key);
  });
});

function fromB64(value: string): Uint8Array {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  return Uint8Array.from(
    atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")),
    (c) => c.codePointAt(0) ?? 0,
  );
}
