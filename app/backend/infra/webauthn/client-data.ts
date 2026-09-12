/**
 * clientDataJSON (WebAuthn §5.8.1) を読み、儀式の前提が揃っているかを確かめる。
 *
 * ここで見るのは「どの儀式か」「どのチャレンジに対する応答か」「どの origin で行われたか」の
 * 3 つ。**この 3 つが passkey のフィッシング耐性の実体**で、署名の検証とは別に必ず行う。
 * origin は認証器が勝手に名乗れる値ではなく、ブラウザが書き込む。
 */

export class ClientDataError extends Error {
  readonly name = "ClientDataError";
}

export type CeremonyType = "webauthn.create" | "webauthn.get";

export interface ParsedClientData {
  readonly type: CeremonyType;
  /** base64url のまま比べる (元のバイト列に戻す必要が無い)。 */
  readonly challenge: string;
  readonly origin: string;
  readonly crossOrigin: boolean;
}

export interface ExpectedCeremony {
  readonly type: CeremonyType;
  readonly challenge: string;
  /** 受け入れる origin。`https://yantene.net` のようにスキームまで含む。 */
  readonly origin: string;
}

/**
 * clientDataJSON を読んで期待と突き合わせる。1 つでも違えば送出する。
 *
 * **JSON を読むのに手心を加えない。** 仕様は「登録時に保存した JSON テキストと
 * 突き合わせる」やり方も許しているが、ここでは毎回パースして 3 つを見る。
 */
export function verifyClientData(bytes: Uint8Array, expected: ExpectedCeremony): ParsedClientData {
  const parsed = parseClientData(bytes);

  if (parsed.type !== expected.type) {
    throw new ClientDataError(
      `expected ceremony ${expected.type}, got ${JSON.stringify(parsed.type)}`,
    );
  }
  if (parsed.challenge !== expected.challenge) {
    // チャレンジそのものは載せない。ログに残ると使い回しの手掛かりになる。
    throw new ClientDataError("challenge does not match the one issued for this ceremony");
  }
  if (parsed.origin !== expected.origin) {
    throw new ClientDataError(
      `expected origin ${expected.origin}, got ${JSON.stringify(parsed.origin)}`,
    );
  }
  if (parsed.crossOrigin) {
    // 別の生成元の iframe の中で行われた儀式。こちらから埋め込む予定は無い。
    throw new ClientDataError("ceremony was performed in a cross-origin frame");
  }

  return parsed;
}

function parseClientData(bytes: Uint8Array): ParsedClientData {
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new ClientDataError("clientDataJSON is not valid UTF-8 JSON");
  }
  if (typeof json !== "object" || json === null) {
    throw new ClientDataError("clientDataJSON is not an object");
  }

  const record = json as Record<string, unknown>;
  const type = record.type;
  const challenge = record.challenge;
  const origin = record.origin;
  if (type !== "webauthn.create" && type !== "webauthn.get") {
    throw new ClientDataError(`unknown ceremony type ${JSON.stringify(type)}`);
  }
  if (typeof challenge !== "string" || challenge.length === 0) {
    throw new ClientDataError("clientDataJSON has no challenge");
  }
  if (typeof origin !== "string" || origin.length === 0) {
    throw new ClientDataError("clientDataJSON has no origin");
  }

  return {
    type,
    challenge,
    origin,
    // 欄が無ければ同一生成元とみなす (仕様の既定)。真偽値でない値は真として扱い、
    // 読めないものを「安全なほう」に倒さない。
    crossOrigin: record.crossOrigin !== undefined && record.crossOrigin !== false,
  };
}
