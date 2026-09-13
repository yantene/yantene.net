import { decodeCbor, type CborValue } from "./cbor";
import { toBase64Url } from "~/lib/base64url";

/**
 * COSE (RFC 9052) の公開鍵を Web Crypto の `CryptoKey` に直す。
 *
 * 認証器は公開鍵を COSE_Key で渡してくる。`crypto.subtle.importKey` は COSE を知らない
 * ので、JWK に組み替えてから渡す。
 *
 * 受けるのは **ES256 と RS256 の 2 つだけ**。登録を求めるときに
 * `pubKeyCredParams` でこの 2 つしか申告しないので、他の形が来たら想定外として送出する
 * (fail-loud)。WebAuthn の仕様はこの 2 つを「必ず返せる」と定めている。
 */

export class CoseKeyError extends Error {
  readonly name = "CoseKeyError";
}

/** COSE_Key のラベル (RFC 9052 §7)。 */
const LABEL_KTY = 1;
const LABEL_ALG = 3;
/** EC2 では crv、RSA では n。 */
const LABEL_CRV_OR_N = -1;
/** EC2 では x、RSA では e。 */
const LABEL_X_OR_E = -2;
const LABEL_Y = -3;

const KTY_EC2 = 2;
const KTY_RSA = 3;

const ALG_ES256 = -7;
const ALG_RS256 = -257;

const CRV_P256 = 1;

const P256_COORDINATE_BYTES = 32;

/** 保存するときの算法の名前。D1 の列に入れて、読むときに何の鍵かを人が分かるようにする。 */
export type CoseAlgorithmName = "ES256" | "RS256";

export interface ParsedCoseKey {
  readonly algorithm: CoseAlgorithmName;
  /** 検証に使う鍵。`verify` だけができる。 */
  readonly key: CryptoKey;
}

/**
 * COSE_Key のバイト列を読み、検証用の `CryptoKey` にする。
 *
 * @param bytes COSE_Key の CBOR。末尾に余りがあれば送出する
 */
export async function importCoseKey(bytes: Uint8Array): Promise<ParsedCoseKey> {
  const { value, end } = decodeCbor(bytes);
  if (end !== bytes.length) {
    throw new CoseKeyError(`${String(bytes.length - end)} trailing byte(s) after the COSE key`);
  }
  if (!(value instanceof Map)) throw new CoseKeyError("COSE key is not a map");

  const algorithm = readAlgorithm(value);
  switch (algorithm) {
    case "ES256":
      return { algorithm, key: await importEc2(value) };
    case "RS256":
      return { algorithm, key: await importRsa(value) };
  }
}

/**
 * COSE_Key の切れ目を探す。attested credential data では鍵の後ろに拡張が続きうるので、
 * どこまでが鍵かを知る必要がある。
 *
 * @returns 鍵のバイト列
 */
export function sliceCoseKey(bytes: Uint8Array, offset: number): Uint8Array {
  const { end } = decodeCbor(bytes, offset);
  return bytes.slice(offset, end);
}

function readAlgorithm(key: ReadonlyMap<number | string, CborValue>): CoseAlgorithmName {
  const alg = key.get(LABEL_ALG);
  switch (alg) {
    case ALG_ES256:
      return "ES256";
    case ALG_RS256:
      return "RS256";
    default:
      throw new CoseKeyError(
        `unsupported COSE algorithm ${JSON.stringify(alg)} (only ES256 and RS256 are requested)`,
      );
  }
}

async function importEc2(key: ReadonlyMap<number | string, CborValue>): Promise<CryptoKey> {
  expectKeyType(key, KTY_EC2, "ES256");
  if (key.get(LABEL_CRV_OR_N) !== CRV_P256) {
    throw new CoseKeyError(
      `ES256 requires curve P-256, got ${JSON.stringify(key.get(LABEL_CRV_OR_N))}`,
    );
  }
  const x = readCoordinate(key, LABEL_X_OR_E, "x");
  const y = readCoordinate(key, LABEL_Y, "y");

  return importJwk(
    { kty: "EC", crv: "P-256", x: toBase64Url(x), y: toBase64Url(y) },
    { name: "ECDSA", namedCurve: "P-256" },
  );
}

async function importRsa(key: ReadonlyMap<number | string, CborValue>): Promise<CryptoKey> {
  expectKeyType(key, KTY_RSA, "RS256");
  const modulus = readBytes(key, LABEL_CRV_OR_N, "n");
  const exponent = readBytes(key, LABEL_X_OR_E, "e");

  return importJwk(
    // JWK の大きな整数は先頭の 0 を持たない (RFC 7518 §2)。COSE 側が詰めていても落とす。
    {
      kty: "RSA",
      n: toBase64Url(stripLeadingZeros(modulus)),
      e: toBase64Url(stripLeadingZeros(exponent)),
    },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
  );
}

async function importJwk(
  jwk: JsonWebKey,
  algorithm: EcKeyImportParams | RsaHashedImportParams,
): Promise<CryptoKey> {
  try {
    // 取り出せないようにし (extractable: false)、できることを verify だけに絞る。
    return await crypto.subtle.importKey("jwk", { ...jwk, ext: false }, algorithm, false, [
      "verify",
    ]);
  } catch (error) {
    throw new CoseKeyError(`public key could not be imported: ${String(error)}`);
  }
}

function expectKeyType(
  key: ReadonlyMap<number | string, CborValue>,
  expected: number,
  algorithm: string,
): void {
  const kty = key.get(LABEL_KTY);
  if (kty !== expected) {
    throw new CoseKeyError(
      `${algorithm} requires key type ${String(expected)}, got ${JSON.stringify(kty)}`,
    );
  }
}

function readBytes(
  key: ReadonlyMap<number | string, CborValue>,
  label: number,
  name: string,
): Uint8Array {
  const value = key.get(label);
  if (!(value instanceof Uint8Array) || value.length === 0) {
    throw new CoseKeyError(`COSE key is missing ${name}`);
  }
  return value;
}

/**
 * EC の座標を 32 バイトに揃える。
 *
 * JWK は座標を曲線の長さちょうどで書くと定めている (RFC 7518 §6.2.1.2)。仕様どおりの
 * 認証器はそのまま 32 バイトを寄越すが、詰め物を付けたり落としたりする実装に出会っても
 * 検証そのものは正しく行えるので、ここで揃える。**32 バイトに収まらなければ送出する。**
 */
function readCoordinate(
  key: ReadonlyMap<number | string, CborValue>,
  label: number,
  name: string,
): Uint8Array {
  const value = stripLeadingZeros(readBytes(key, label, name));
  if (value.length > P256_COORDINATE_BYTES) {
    throw new CoseKeyError(`COSE key has a ${String(value.length)}-byte ${name} for P-256`);
  }
  const padded = new Uint8Array(P256_COORDINATE_BYTES);
  padded.set(value, P256_COORDINATE_BYTES - value.length);
  return padded;
}

function stripLeadingZeros(value: Uint8Array): Uint8Array {
  let start = 0;
  while (start < value.length - 1 && value[start] === 0) start += 1;
  return value.subarray(start);
}
