import type { IValueObject } from "~/backend/domain/shared";

/** 128 bit を base64url にした 22 文字。 */
const sessionIdPattern = /^[\w-]{22}$/;

const SESSION_ID_BYTES = 16;

export class InvalidSessionIdError extends Error {
  readonly name = "InvalidSessionIdError";
}

/**
 * 読み手のセッションを指す識別子。
 *
 * **推測できないことが要件。** これを当てられると、他人のセッションになりすまして
 * その人の記録を書き換えられる。連番や時刻由来の値ではなく乱数を使う。
 *
 * 発行 (issue) と検証 (create) を同じ場所に置いているのは、書く形と読む形が
 * 食い違わないようにするため。
 */
export class SessionId implements IValueObject<SessionId> {
  private constructor(private readonly value: string) {}

  /** 新しい識別子を発行する。 */
  static issue(): SessionId {
    const bytes = crypto.getRandomValues(new Uint8Array(SESSION_ID_BYTES));
    return new SessionId(toBase64Url(bytes));
  }

  /** 受け取った文字列を識別子として検証する。形が違えば throw。 */
  static create(raw: string): SessionId {
    if (!sessionIdPattern.test(raw)) {
      throw new InvalidSessionIdError("Session id must be 22 base64url chars");
    }
    return new SessionId(raw);
  }

  toString(): string {
    return this.value;
  }

  equals(other: SessionId): boolean {
    return this.value === other.value;
  }

  toJSON(): string {
    return this.value;
  }
}

/** 乱数を cookie にも KV のキーにもそのまま載せられる形にする。 */
function toBase64Url(bytes: Uint8Array): string {
  const binary = String.fromCodePoint(...bytes);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}
