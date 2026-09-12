import { describe, expect, it } from "vitest";
import { AuthenticatorDataError, parseAuthenticatorData } from "./authenticator-data";
import {
  buildAuthenticatorData,
  concat,
  encodeCbor,
  es256CoseKey,
  FLAG_ATTESTED_CREDENTIAL_DATA,
  FLAG_BACKUP_ELIGIBLE,
  FLAG_BACKUP_STATE,
  FLAG_EXTENSION_DATA,
  FLAG_USER_PRESENT,
  FLAG_USER_VERIFIED,
  sha256,
} from "./test-helper";

async function anyCoseKey(): Promise<Uint8Array> {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);
  return es256CoseKey(await crypto.subtle.exportKey("jwk", pair.publicKey));
}

describe("parseAuthenticatorData", () => {
  it("認証の応答 (37 バイト) を読む", async () => {
    const bytes = await buildAuthenticatorData({
      rpId: "yantene.net",
      flags: FLAG_USER_PRESENT | FLAG_USER_VERIFIED,
      signCount: 42,
    });
    expect(bytes.length).toBe(37);

    const parsed = parseAuthenticatorData(bytes);
    expect(parsed.rpIdHash).toEqual(await sha256(new TextEncoder().encode("yantene.net")));
    expect(parsed.flags.userPresent).toBe(true);
    expect(parsed.flags.userVerified).toBe(true);
    expect(parsed.signCount).toBe(42);
    expect(parsed.attestedCredential).toBeUndefined();
  });

  it("フラグを 1 つずつ読み分ける", async () => {
    const parsed = parseAuthenticatorData(
      await buildAuthenticatorData({
        rpId: "yantene.net",
        flags: FLAG_USER_PRESENT | FLAG_BACKUP_ELIGIBLE | FLAG_BACKUP_STATE,
        signCount: 0,
      }),
    );
    expect(parsed.flags).toEqual({
      userPresent: true,
      userVerified: false,
      backupEligible: true,
      backupState: true,
    });
  });

  it("登録の応答から credential id と公開鍵を取り出す", async () => {
    const coseKey = await anyCoseKey();
    const credentialId = crypto.getRandomValues(new Uint8Array(20));
    const aaguid = crypto.getRandomValues(new Uint8Array(16));

    const parsed = parseAuthenticatorData(
      await buildAuthenticatorData({
        rpId: "localhost",
        flags: FLAG_USER_PRESENT | FLAG_USER_VERIFIED | FLAG_ATTESTED_CREDENTIAL_DATA,
        signCount: 0,
        attested: { aaguid, credentialId, coseKey },
      }),
    );

    expect(parsed.attestedCredential?.aaguid).toEqual(aaguid);
    expect(parsed.attestedCredential?.credentialId).toEqual(credentialId);
    expect(parsed.attestedCredential?.coseKey).toEqual(coseKey);
  });

  it("公開鍵の後ろに拡張が続いていても鍵を取り違えない", async () => {
    const coseKey = await anyCoseKey();
    const credentialId = crypto.getRandomValues(new Uint8Array(32));

    const parsed = parseAuthenticatorData(
      await buildAuthenticatorData({
        rpId: "localhost",
        flags:
          FLAG_USER_PRESENT |
          FLAG_USER_VERIFIED |
          FLAG_ATTESTED_CREDENTIAL_DATA |
          FLAG_EXTENSION_DATA,
        signCount: 0,
        attested: { credentialId, coseKey },
        extensions: encodeCbor(new Map<string, unknown>([["credProtect", 2]])),
      }),
    );

    expect(parsed.attestedCredential?.coseKey).toEqual(coseKey);
    expect(parsed.attestedCredential?.credentialId).toEqual(credentialId);
  });

  it("署名回数は 32 ビットの上限まで読める", async () => {
    const parsed = parseAuthenticatorData(
      await buildAuthenticatorData({
        rpId: "yantene.net",
        flags: FLAG_USER_PRESENT,
        signCount: 0xff_ff_ff_ff,
      }),
    );
    expect(parsed.signCount).toBe(4_294_967_295);
  });

  it("ヘッダより短ければ送出する", () => {
    expect(() => parseAuthenticatorData(new Uint8Array(36))).toThrow(AuthenticatorDataError);
  });

  it("AT が立っているのに中身が足りなければ送出する", async () => {
    const truncated = (
      await buildAuthenticatorData({
        rpId: "yantene.net",
        flags: FLAG_USER_PRESENT | FLAG_ATTESTED_CREDENTIAL_DATA,
        signCount: 0,
        attested: { credentialId: new Uint8Array(16), coseKey: await anyCoseKey() },
      })
    ).slice(0, 50);
    expect(() => parseAuthenticatorData(truncated)).toThrow(AuthenticatorDataError);
  });

  it("credential id の長さが 0 なら送出する", async () => {
    const header = await buildAuthenticatorData({
      rpId: "yantene.net",
      flags: FLAG_USER_PRESENT | FLAG_ATTESTED_CREDENTIAL_DATA,
      signCount: 0,
    });
    const bytes = concat(header, new Uint8Array(16), new Uint8Array([0, 0]), await anyCoseKey());
    expect(() => parseAuthenticatorData(bytes)).toThrow(AuthenticatorDataError);
  });

  it("credential id の長さが仕様の上限を越えたら送出する", async () => {
    const header = await buildAuthenticatorData({
      rpId: "yantene.net",
      flags: FLAG_USER_PRESENT | FLAG_ATTESTED_CREDENTIAL_DATA,
      signCount: 0,
    });
    // 1024 は 1023 を 1 つ越える。長さの欄だけなら 65535 まで書けてしまう。
    const bytes = concat(
      header,
      new Uint8Array(16),
      new Uint8Array([0x04, 0x00]),
      new Uint8Array(2000),
    );
    expect(() => parseAuthenticatorData(bytes)).toThrow(AuthenticatorDataError);
  });

  it("公開鍵が無ければ送出する", async () => {
    const header = await buildAuthenticatorData({
      rpId: "yantene.net",
      flags: FLAG_USER_PRESENT | FLAG_ATTESTED_CREDENTIAL_DATA,
      signCount: 0,
    });
    const bytes = concat(header, new Uint8Array(16), new Uint8Array([0, 4]), new Uint8Array(4));
    expect(() => parseAuthenticatorData(bytes)).toThrow(AuthenticatorDataError);
  });
});
