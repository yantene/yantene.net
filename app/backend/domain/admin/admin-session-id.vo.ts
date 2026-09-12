import type { IValueObject } from "~/backend/domain/shared";

/** 128 bit を base64url にした 22 文字。 */
const pattern = /^[\w-]{22}$/;

const SESSION_ID_BYTES = 16;

export class InvalidAdminSessionIdError extends Error {
  readonly name = "InvalidAdminSessionIdError";
}

/**
 * 管理者のセッションを指す識別子。
 *
 * **読み手のセッション (ADR 0011) とは別物。** 形は同じだが、当てられたときに渡るものが
 * 違う。あちらは「その日どの記事を読んだか」で、こちらは記事を書き換えられる権限。
 * 同じ型にして取り違えることのないよう、別の VO として持つ。
 */
export class AdminSessionId implements IValueObject<AdminSessionId> {
  private constructor(private readonly value: string) {}

  static issue(): AdminSessionId {
    const bytes = crypto.getRandomValues(new Uint8Array(SESSION_ID_BYTES));
    const binary = String.fromCodePoint(...bytes);
    return new AdminSessionId(
      btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", ""),
    );
  }

  static create(raw: string): AdminSessionId {
    if (!pattern.test(raw)) {
      throw new InvalidAdminSessionIdError("Admin session id must be 22 base64url chars");
    }
    return new AdminSessionId(raw);
  }

  toString(): string {
    return this.value;
  }

  equals(other: AdminSessionId): boolean {
    return this.value === other.value;
  }

  toJSON(): string {
    return this.value;
  }
}
