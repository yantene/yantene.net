import { describe, expect, it } from "vitest";
import { ClientDataError, verifyClientData, type ExpectedCeremony } from "./client-data";

const expected: ExpectedCeremony = {
  type: "webauthn.get",
  challenge: "Q0hBTExFTkdF",
  origin: "https://yantene.net",
};

function clientData(overrides: Record<string, unknown> = {}): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify({
      type: "webauthn.get",
      challenge: "Q0hBTExFTkdF",
      origin: "https://yantene.net",
      crossOrigin: false,
      ...overrides,
    }),
  );
}

describe("verifyClientData", () => {
  it("揃っていれば読んだ内容を返す", () => {
    expect(verifyClientData(clientData(), expected)).toEqual({
      type: "webauthn.get",
      challenge: "Q0hBTExFTkdF",
      origin: "https://yantene.net",
      crossOrigin: false,
    });
  });

  it("知らない欄が増えていても読める", () => {
    expect(() =>
      verifyClientData(clientData({ topOrigin: "https://x.example" }), expected),
    ).not.toThrow();
  });

  it("crossOrigin が無くても同一生成元として読む", () => {
    const bytes = new TextEncoder().encode(
      JSON.stringify({
        type: "webauthn.get",
        challenge: "Q0hBTExFTkdF",
        origin: "https://yantene.net",
      }),
    );
    expect(verifyClientData(bytes, expected).crossOrigin).toBe(false);
  });

  it("儀式の種類が違えば送出する", () => {
    expect(() => verifyClientData(clientData({ type: "webauthn.create" }), expected)).toThrow(
      ClientDataError,
    );
  });

  it("チャレンジが違えば送出する", () => {
    expect(() => verifyClientData(clientData({ challenge: "b3RoZXI" }), expected)).toThrow(
      ClientDataError,
    );
  });

  it("チャレンジそのものはメッセージに出さない", () => {
    // 記録に残ると、使い回しの手掛かりになる。
    const message = messageOf(() =>
      verifyClientData(clientData({ challenge: "b3RoZXI" }), expected),
    );
    expect(message).not.toContain("b3RoZXI");
    expect(message).not.toContain("Q0hBTExFTkdF");
  });

  it("origin が違えば送出する", () => {
    expect(() =>
      verifyClientData(clientData({ origin: "https://yantene.net.evil.example" }), expected),
    ).toThrow(ClientDataError);
  });

  it("scheme だけ違う origin も送出する", () => {
    expect(() => verifyClientData(clientData({ origin: "http://yantene.net" }), expected)).toThrow(
      ClientDataError,
    );
  });

  it("別の生成元の frame で行われた儀式は送出する", () => {
    expect(() => verifyClientData(clientData({ crossOrigin: true }), expected)).toThrow(
      ClientDataError,
    );
  });

  it("crossOrigin が真偽値でなければ安全なほうに倒さず送出する", () => {
    expect(() => verifyClientData(clientData({ crossOrigin: "false" }), expected)).toThrow(
      ClientDataError,
    );
  });

  it("JSON でなければ送出する", () => {
    expect(() => verifyClientData(new TextEncoder().encode("{"), expected)).toThrow(
      ClientDataError,
    );
  });

  it("オブジェクトでなければ送出する", () => {
    expect(() => verifyClientData(new TextEncoder().encode('"x"'), expected)).toThrow(
      ClientDataError,
    );
  });

  it("欄が欠けていれば送出する", () => {
    const noChallenge = new TextEncoder().encode(
      JSON.stringify({ type: "webauthn.get", origin: "https://yantene.net" }),
    );
    expect(() => verifyClientData(noChallenge, expected)).toThrow(ClientDataError);
  });
});

/** 送出されたエラーのメッセージを取り出す。送出されなければテストを落とす。 */
function messageOf(work: () => unknown): string {
  try {
    work();
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error("expected the call to throw");
}
