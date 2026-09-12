import { toBase64Url } from "~/lib/base64url";

/**
 * テスト用の認証器の模型。
 *
 * WebAuthn の検証を確かめるには、認証器が出すのと同じ形のバイト列が要る。実機の応答を
 * 写して置くと、鍵を持たないので「落ちるべき入力で落ちる」ことを確かめられない
 * (署名を作り直せないため)。ここで鍵ごと作る。
 */

/* ------------------------------------------------------------------ CBOR */

/** テストで使うぶんだけの CBOR エンコーダ。デコーダ (cbor.ts) と対で使う。 */
export function encodeCbor(value: unknown): Uint8Array {
  if (typeof value === "number") return encodeInteger(value);
  if (value instanceof Uint8Array) return concat(encodeHead(2, value.length), value);
  if (typeof value === "string") {
    const utf8 = new TextEncoder().encode(value);
    return concat(encodeHead(3, utf8.length), utf8);
  }
  if (Array.isArray(value)) {
    return concat(encodeHead(4, value.length), ...value.map((item) => encodeCbor(item)));
  }
  if (value instanceof Map) {
    const entries = [...value.entries()];
    return concat(
      encodeHead(5, entries.length),
      ...entries.flatMap(([key, item]) => [encodeCbor(key), encodeCbor(item)]),
    );
  }
  throw new Error(`test encoder cannot encode ${String(value)}`);
}

function encodeInteger(value: number): Uint8Array {
  return value < 0 ? encodeHead(1, -1 - value) : encodeHead(0, value);
}

function encodeHead(major: number, argument: number): Uint8Array {
  const tag = major << 5;
  if (argument < 24) return new Uint8Array([tag | argument]);
  if (argument < 0x100) return new Uint8Array([tag | 24, argument]);
  if (argument < 0x1_00_00) return new Uint8Array([tag | 25, argument >> 8, argument & 0xff]);
  return new Uint8Array([
    tag | 26,
    (argument >>> 24) & 0xff,
    (argument >>> 16) & 0xff,
    (argument >>> 8) & 0xff,
    argument & 0xff,
  ]);
}

export function concat(...parts: readonly Uint8Array[]): Uint8Array<ArrayBuffer> {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    joined.set(part, offset);
    offset += part.length;
  }
  return joined;
}

/* ------------------------------------------------------------- COSE 公開鍵 */

function fromBase64UrlStrict(value: string): Uint8Array {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  return Uint8Array.from(
    atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")),
    (character) => character.codePointAt(0) ?? 0,
  );
}

/** ES256 の JWK 公開鍵を COSE_Key の CBOR にする。 */
export function es256CoseKey(jwk: JsonWebKey): Uint8Array {
  return encodeCbor(
    new Map<number, unknown>([
      [1, 2], // kty: EC2
      [3, -7], // alg: ES256
      [-1, 1], // crv: P-256
      [-2, fromBase64UrlStrict(jwk.x ?? "")],
      [-3, fromBase64UrlStrict(jwk.y ?? "")],
    ]),
  );
}

/** RS256 の JWK 公開鍵を COSE_Key の CBOR にする。 */
export function rs256CoseKey(jwk: JsonWebKey): Uint8Array {
  return encodeCbor(
    new Map<number, unknown>([
      [1, 3], // kty: RSA
      [3, -257], // alg: RS256
      [-1, fromBase64UrlStrict(jwk.n ?? "")],
      [-2, fromBase64UrlStrict(jwk.e ?? "")],
    ]),
  );
}

/* ------------------------------------------------- authenticator data の組立 */

export const FLAG_USER_PRESENT = 0x01;
export const FLAG_USER_VERIFIED = 0x04;
export const FLAG_BACKUP_ELIGIBLE = 0x08;
export const FLAG_BACKUP_STATE = 0x10;
export const FLAG_ATTESTED_CREDENTIAL_DATA = 0x40;
export const FLAG_EXTENSION_DATA = 0x80;

export async function sha256(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}

export interface AuthenticatorDataParts {
  readonly rpId: string;
  readonly flags: number;
  readonly signCount: number;
  /** 登録のときだけ付く attested credential data。 */
  readonly attested?: {
    readonly aaguid?: Uint8Array;
    readonly credentialId: Uint8Array;
    readonly coseKey: Uint8Array;
  };
  /** 鍵の後ろに続く拡張 (CBOR の map)。 */
  readonly extensions?: Uint8Array;
}

export async function buildAuthenticatorData(
  parts: AuthenticatorDataParts,
): Promise<Uint8Array<ArrayBuffer>> {
  const rpIdHash = await sha256(new TextEncoder().encode(parts.rpId));
  const header = new Uint8Array(5);
  header[0] = parts.flags;
  new DataView(header.buffer).setUint32(1, parts.signCount, false);

  const pieces: Uint8Array[] = [rpIdHash, header];
  if (parts.attested !== undefined) {
    const { aaguid = new Uint8Array(16), credentialId, coseKey } = parts.attested;
    const length = new Uint8Array(2);
    new DataView(length.buffer).setUint16(0, credentialId.length, false);
    pieces.push(aaguid, length, credentialId, coseKey);
  }
  if (parts.extensions !== undefined) pieces.push(parts.extensions);
  return concat(...pieces);
}

/** attestation statement を持たない (`none`) attestation object。 */
export function buildAttestationObject(authenticatorData: Uint8Array): Uint8Array {
  return encodeCbor(
    new Map<string, unknown>([
      ["fmt", "none"],
      ["attStmt", new Map()],
      ["authData", authenticatorData],
    ]),
  );
}

/* ---------------------------------------------------------- 認証器そのもの */

export interface FakeAuthenticatorOptions {
  readonly rpId: string;
  readonly origin: string;
  readonly credentialId?: Uint8Array;
}

/**
 * 鍵を持ち、登録と認証の応答を組み立てる模型。
 *
 * 署名は本物 (Web Crypto) なので、検証を通るべき応答は通り、いじった応答は落ちる。
 */
export class FakeAuthenticator {
  private constructor(
    readonly rpId: string,
    readonly origin: string,
    readonly credentialId: Uint8Array,
    private readonly keyPair: CryptoKeyPair,
    private readonly jwk: JsonWebKey,
    private signCount: number,
  ) {}

  static async create(options: FakeAuthenticatorOptions): Promise<FakeAuthenticator> {
    const keyPair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
      "sign",
      "verify",
    ]);
    const jwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
    return new FakeAuthenticator(
      options.rpId,
      options.origin,
      options.credentialId ?? crypto.getRandomValues(new Uint8Array(32)),
      keyPair,
      jwk,
      0,
    );
  }

  get coseKey(): Uint8Array {
    return es256CoseKey(this.jwk);
  }

  clientDataJson(type: "webauthn.create" | "webauthn.get", challenge: string): Uint8Array {
    return new TextEncoder().encode(
      JSON.stringify({ type, challenge, origin: this.origin, crossOrigin: false }),
    );
  }

  /** 登録の応答 (`navigator.credentials.create` が返すもの)。 */
  async register(
    challenge: string,
    overrides: { flags?: number; rpId?: string } = {},
  ): Promise<{ clientDataJSON: string; attestationObject: string; id: string }> {
    const authenticatorData = await buildAuthenticatorData({
      rpId: overrides.rpId ?? this.rpId,
      flags:
        overrides.flags ?? FLAG_USER_PRESENT | FLAG_USER_VERIFIED | FLAG_ATTESTED_CREDENTIAL_DATA,
      signCount: 0,
      attested: { credentialId: this.credentialId, coseKey: this.coseKey },
    });
    return {
      id: toBase64Url(this.credentialId),
      clientDataJSON: toBase64Url(this.clientDataJson("webauthn.create", challenge)),
      attestationObject: toBase64Url(buildAttestationObject(authenticatorData)),
    };
  }

  /** 認証の応答 (`navigator.credentials.get` が返すもの)。 */
  async authenticate(
    challenge: string,
    overrides: { flags?: number; rpId?: string; signCount?: number; origin?: string } = {},
  ): Promise<{
    id: string;
    clientDataJSON: string;
    authenticatorData: string;
    signature: string;
  }> {
    this.signCount += 1;
    const authenticatorData = await buildAuthenticatorData({
      rpId: overrides.rpId ?? this.rpId,
      flags: overrides.flags ?? FLAG_USER_PRESENT | FLAG_USER_VERIFIED,
      signCount: overrides.signCount ?? this.signCount,
    });
    const clientDataJson = new TextEncoder().encode(
      JSON.stringify({
        type: "webauthn.get",
        challenge,
        origin: overrides.origin ?? this.origin,
        crossOrigin: false,
      }),
    );
    const signed = concat(authenticatorData, await sha256(clientDataJson));
    const raw = new Uint8Array(
      await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, this.keyPair.privateKey, signed),
    );
    return {
      id: toBase64Url(this.credentialId),
      clientDataJSON: toBase64Url(clientDataJson),
      authenticatorData: toBase64Url(authenticatorData),
      signature: toBase64Url(rawToDer(raw)),
    };
  }
}

/** Web Crypto の raw 署名を、認証器が出すのと同じ DER に包む。 */
export function rawToDer(raw: Uint8Array): Uint8Array<ArrayBuffer> {
  const half = raw.length / 2;
  const content = [...derInteger(raw.subarray(0, half)), ...derInteger(raw.subarray(half))];
  return new Uint8Array([0x30, content.length, ...content]);
}

function derInteger(value: Uint8Array): number[] {
  let start = 0;
  while (start < value.length - 1 && value[start] === 0) start += 1;
  const significant = [...value.subarray(start)];
  return [
    0x02,
    ((significant[0] ?? 0) >= 0x80 ? 1 : 0) + significant.length,
    ...((significant[0] ?? 0) >= 0x80 ? [0] : []),
    ...significant,
  ];
}
