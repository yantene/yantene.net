import type { IValueObject } from "~/backend/domain/shared";
import { randomBase64Url } from "~/lib/base64url";
import { InvalidAuthSessionIdError } from "./errors";

/** 128 bit を base64url にした 22 文字。 */
const pattern = /^[\w-]{22}$/;

const SESSION_ID_BYTES = 16;

/**
 * ログインしている人のセッションを指す識別子。
 *
 * **読み手のセッション (ADR 0011) とは別物。** 形は同じだが、当てられたときに渡る
 * ものが違う。あちらは「その日どの記事を読んだか」で、こちらは身元そのもの。
 * 同じ型にして取り違えることのないよう、別の VO として持つ。
 */
export class AuthSessionId implements IValueObject<AuthSessionId> {
  private constructor(private readonly value: string) {}

  static issue(): AuthSessionId {
    return new AuthSessionId(randomBase64Url(SESSION_ID_BYTES));
  }

  static create(raw: string): AuthSessionId {
    if (!pattern.test(raw)) {
      throw new InvalidAuthSessionIdError("Auth session id must be 22 base64url chars");
    }
    return new AuthSessionId(raw);
  }

  toString(): string {
    return this.value;
  }

  equals(other: AuthSessionId): boolean {
    return this.value === other.value;
  }

  toJSON(): string {
    return this.value;
  }
}
