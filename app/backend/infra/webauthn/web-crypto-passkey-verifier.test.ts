import { Temporal } from "@js-temporal/polyfill";
import { beforeAll, describe, expect, it } from "vitest";
import { WebCryptoPasskeyVerifier } from "./web-crypto-passkey-verifier";
import {
  buildAttestationObject,
  buildAuthenticatorData,
  FakeAuthenticator,
  FLAG_ATTESTED_CREDENTIAL_DATA,
  FLAG_USER_PRESENT,
  FLAG_USER_VERIFIED,
} from "./test-helper";
import type { CeremonyExpectation } from "~/backend/domain/admin";
import {
  AdminCredential,
  Challenge,
  CredentialId,
  PasskeyVerificationError,
} from "~/backend/domain/admin";
import { toBase64Url } from "~/lib/base64url";

const RP_ID = "yantene.net";
const ORIGIN = "https://yantene.net";

const verifier = new WebCryptoPasskeyVerifier();

function expectation(challenge: string): CeremonyExpectation {
  return { origin: ORIGIN, rpId: RP_ID, challenge };
}

let authenticator: FakeAuthenticator;

beforeAll(async () => {
  authenticator = await FakeAuthenticator.create({ rpId: RP_ID, origin: ORIGIN });
});

/** 検証を通った登録から、認証の検証に渡す資格情報を組み立てる。 */
async function registerCredential(): Promise<AdminCredential> {
  const challenge = Challenge.issue().toString();
  const verified = await verifier.verifyRegistration(
    await authenticator.register(challenge),
    expectation(challenge),
  );
  return AdminCredential.register({
    id: verified.credentialId,
    publicKey: verified.publicKey,
    algorithm: verified.algorithm,
    signCount: verified.signCount,
    label: "test",
    backedUp: verified.backedUp,
    at: Temporal.Instant.from("2026-09-12T00:00:00Z"),
  });
}

describe("verifyRegistration", () => {
  it("正しい応答から credential id と公開鍵を取り出す", async () => {
    const challenge = Challenge.issue().toString();
    const response = await authenticator.register(challenge);

    const verified = await verifier.verifyRegistration(response, expectation(challenge));

    expect(verified.credentialId.toString()).toBe(toBase64Url(authenticator.credentialId));
    expect(verified.algorithm).toBe("ES256");
    expect(verified.publicKey).toBe(toBase64Url(authenticator.coseKey));
  });

  it("取り出した公開鍵で、その後の認証が通る", async () => {
    const credential = await registerCredential();
    const challenge = Challenge.issue().toString();

    await expect(
      verifier.verifyAuthentication(
        await authenticator.authenticate(challenge),
        credential,
        expectation(challenge),
      ),
    ).resolves.toMatchObject({ credentialId: credential.id });
  });

  it("違うチャレンジの応答は落ちる", async () => {
    const response = await authenticator.register(Challenge.issue().toString());
    await expect(
      verifier.verifyRegistration(response, expectation(Challenge.issue().toString())),
    ).rejects.toThrow(PasskeyVerificationError);
  });

  it("違う origin の応答は落ちる", async () => {
    const evil = await FakeAuthenticator.create({ rpId: RP_ID, origin: "https://evil.example" });
    const challenge = Challenge.issue().toString();
    await expect(
      verifier.verifyRegistration(await evil.register(challenge), expectation(challenge)),
    ).rejects.toThrow(PasskeyVerificationError);
  });

  it("違う RP ID で署名された応答は落ちる", async () => {
    const challenge = Challenge.issue().toString();
    const response = await authenticator.register(challenge, { rpId: "evil.example" });
    await expect(verifier.verifyRegistration(response, expectation(challenge))).rejects.toThrow(
      PasskeyVerificationError,
    );
  });

  it("利用者を確かめていない (UV なし) 応答は落ちる", async () => {
    const challenge = Challenge.issue().toString();
    const response = await authenticator.register(challenge, {
      flags: FLAG_USER_PRESENT | FLAG_ATTESTED_CREDENTIAL_DATA,
    });
    await expect(verifier.verifyRegistration(response, expectation(challenge))).rejects.toThrow(
      PasskeyVerificationError,
    );
  });

  it("誰も触っていない (UP なし) 応答は落ちる", async () => {
    const challenge = Challenge.issue().toString();
    const response = await authenticator.register(challenge, {
      flags: FLAG_USER_VERIFIED | FLAG_ATTESTED_CREDENTIAL_DATA,
    });
    await expect(verifier.verifyRegistration(response, expectation(challenge))).rejects.toThrow(
      PasskeyVerificationError,
    );
  });

  it("credential id が無い (AT なし) 応答は落ちる", async () => {
    const challenge = Challenge.issue().toString();
    const authenticatorData = await buildAuthenticatorData({
      rpId: RP_ID,
      flags: FLAG_USER_PRESENT | FLAG_USER_VERIFIED,
      signCount: 0,
    });
    await expect(
      verifier.verifyRegistration(
        {
          id: "AAAA",
          clientDataJSON: toBase64Url(authenticator.clientDataJson("webauthn.create", challenge)),
          attestationObject: toBase64Url(buildAttestationObject(authenticatorData)),
        },
        expectation(challenge),
      ),
    ).rejects.toThrow(PasskeyVerificationError);
  });

  it("JSON 側の credential id が署名された値と食い違えば落ちる", async () => {
    const challenge = Challenge.issue().toString();
    const response = await authenticator.register(challenge);
    await expect(
      verifier.verifyRegistration(
        { ...response, id: "c29tZXRoaW5nLWVsc2U" },
        expectation(challenge),
      ),
    ).rejects.toThrow(PasskeyVerificationError);
  });

  it("認証の儀式 (webauthn.get) の応答を登録として受け取らない", async () => {
    const challenge = Challenge.issue().toString();
    const authenticatorData = await buildAuthenticatorData({
      rpId: RP_ID,
      flags: FLAG_USER_PRESENT | FLAG_USER_VERIFIED | FLAG_ATTESTED_CREDENTIAL_DATA,
      signCount: 0,
      attested: { credentialId: authenticator.credentialId, coseKey: authenticator.coseKey },
    });
    await expect(
      verifier.verifyRegistration(
        {
          id: toBase64Url(authenticator.credentialId),
          clientDataJSON: toBase64Url(authenticator.clientDataJson("webauthn.get", challenge)),
          attestationObject: toBase64Url(buildAttestationObject(authenticatorData)),
        },
        expectation(challenge),
      ),
    ).rejects.toThrow(PasskeyVerificationError);
  });

  it("base64url でない値は落ちる", async () => {
    const challenge = Challenge.issue().toString();
    const response = await authenticator.register(challenge);
    await expect(
      verifier.verifyRegistration(
        { ...response, attestationObject: "not base64!" },
        expectation(challenge),
      ),
    ).rejects.toThrow(PasskeyVerificationError);
  });

  it("attestation object が CBOR でなければ落ちる", async () => {
    const challenge = Challenge.issue().toString();
    const response = await authenticator.register(challenge);
    await expect(
      verifier.verifyRegistration(
        { ...response, attestationObject: "AQID" },
        expectation(challenge),
      ),
    ).rejects.toThrow(PasskeyVerificationError);
  });
});

describe("verifyAuthentication", () => {
  let credential: AdminCredential;

  beforeAll(async () => {
    credential = await registerCredential();
  });

  it("正しい応答を通す", async () => {
    const challenge = Challenge.issue().toString();
    const verified = await verifier.verifyAuthentication(
      await authenticator.authenticate(challenge),
      credential,
      expectation(challenge),
    );
    expect(verified.credentialId.equals(credential.id)).toBe(true);
    expect(verified.signCount).toBeGreaterThan(0);
  });

  it("署名を 1 ビット変えたら落ちる", async () => {
    const challenge = Challenge.issue().toString();
    const response = await authenticator.authenticate(challenge);
    // DER の末尾 (s の最下位バイト) を変える。形は保ったまま値だけを崩す。
    const last = response.signature.slice(-1);
    const signature = response.signature.slice(0, -1) + (last === "A" ? "B" : "A");

    await expect(
      verifier.verifyAuthentication({ ...response, signature }, credential, expectation(challenge)),
    ).rejects.toThrow(PasskeyVerificationError);
  });

  it("別の鍵で署名された応答は落ちる", async () => {
    const other = await FakeAuthenticator.create({
      rpId: RP_ID,
      origin: ORIGIN,
      credentialId: authenticator.credentialId,
    });
    const challenge = Challenge.issue().toString();
    await expect(
      verifier.verifyAuthentication(
        await other.authenticate(challenge),
        credential,
        expectation(challenge),
      ),
    ).rejects.toThrow(PasskeyVerificationError);
  });

  it("別の credential への応答は落ちる", async () => {
    const other = await FakeAuthenticator.create({ rpId: RP_ID, origin: ORIGIN });
    const challenge = Challenge.issue().toString();
    await expect(
      verifier.verifyAuthentication(
        await other.authenticate(challenge),
        credential,
        expectation(challenge),
      ),
    ).rejects.toThrow(PasskeyVerificationError);
  });

  it("違うチャレンジの応答は落ちる", async () => {
    const response = await authenticator.authenticate(Challenge.issue().toString());
    await expect(
      verifier.verifyAuthentication(
        response,
        credential,
        expectation(Challenge.issue().toString()),
      ),
    ).rejects.toThrow(PasskeyVerificationError);
  });

  it("違う origin の応答は落ちる", async () => {
    const challenge = Challenge.issue().toString();
    const response = await authenticator.authenticate(challenge, {
      origin: "https://yantene.net.evil.example",
    });
    await expect(
      verifier.verifyAuthentication(response, credential, expectation(challenge)),
    ).rejects.toThrow(PasskeyVerificationError);
  });

  it("違う RP ID で署名された応答は落ちる", async () => {
    const challenge = Challenge.issue().toString();
    const response = await authenticator.authenticate(challenge, { rpId: "evil.example" });
    await expect(
      verifier.verifyAuthentication(response, credential, expectation(challenge)),
    ).rejects.toThrow(PasskeyVerificationError);
  });

  it("利用者を確かめていない (UV なし) 応答は落ちる", async () => {
    const challenge = Challenge.issue().toString();
    const response = await authenticator.authenticate(challenge, { flags: FLAG_USER_PRESENT });
    await expect(
      verifier.verifyAuthentication(response, credential, expectation(challenge)),
    ).rejects.toThrow(PasskeyVerificationError);
  });

  it("誰も触っていない (UP なし) 応答は落ちる", async () => {
    const challenge = Challenge.issue().toString();
    const response = await authenticator.authenticate(challenge, { flags: FLAG_USER_VERIFIED });
    await expect(
      verifier.verifyAuthentication(response, credential, expectation(challenge)),
    ).rejects.toThrow(PasskeyVerificationError);
  });

  it("authenticatorData を差し替えたら落ちる (署名の対象に入っている)", async () => {
    const challenge = Challenge.issue().toString();
    const response = await authenticator.authenticate(challenge);
    const tampered = toBase64Url(
      await buildAuthenticatorData({
        rpId: RP_ID,
        flags: FLAG_USER_PRESENT | FLAG_USER_VERIFIED,
        signCount: 9999,
      }),
    );
    await expect(
      verifier.verifyAuthentication(
        { ...response, authenticatorData: tampered },
        credential,
        expectation(challenge),
      ),
    ).rejects.toThrow(PasskeyVerificationError);
  });

  it("知らない算法の公開鍵が入っていたら落ちる", async () => {
    const challenge = Challenge.issue().toString();
    const broken = AdminCredential.reconstruct({
      id: credential.id,
      publicKey: "AQID",
      algorithm: "ES256",
      signCount: 0,
      label: "broken",
      backedUp: false,
      createdAt: Temporal.Instant.from("2026-09-12T00:00:00Z"),
      lastUsedAt: undefined,
    });
    await expect(
      verifier.verifyAuthentication(
        await authenticator.authenticate(challenge),
        broken,
        expectation(challenge),
      ),
    ).rejects.toThrow(PasskeyVerificationError);
  });

  it("credential id の形が違っても id の突き合わせで落ちる", async () => {
    const challenge = Challenge.issue().toString();
    const response = await authenticator.authenticate(challenge);
    const other = AdminCredential.reconstruct({
      id: CredentialId.create("c29tZXRoaW5nLWVsc2U"),
      publicKey: credential.publicKey,
      algorithm: "ES256",
      signCount: 0,
      label: "other",
      backedUp: false,
      createdAt: Temporal.Instant.from("2026-09-12T00:00:00Z"),
      lastUsedAt: undefined,
    });
    await expect(
      verifier.verifyAuthentication(response, other, expectation(challenge)),
    ).rejects.toThrow(PasskeyVerificationError);
  });
});
