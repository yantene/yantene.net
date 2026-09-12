import type { IValueObject } from "~/backend/domain/shared";

/**
 * passkey の credential を指す識別子。
 *
 * 認証器が決めた値で、こちらでは選べない。WebAuthn の JSON 表現に合わせて base64url の
 * ままで持つ。**秘密ではない** (認証の要求で平文で飛ぶ) ので、推測できないことは
 * 求めない。求めるのは「D1 の主キーとして使える形であること」だけ。
 */

/** WebAuthn が定める credential id の長さの上限 (1023 バイト) を base64url にしたときの文字数。 */
const MAX_LENGTH = 1364;

const pattern = /^[\w-]+$/;

export class InvalidCredentialIdError extends Error {
  readonly name = "InvalidCredentialIdError";
}

export class CredentialId implements IValueObject<CredentialId> {
  private constructor(private readonly value: string) {}

  static create(raw: string): CredentialId {
    if (!pattern.test(raw) || raw.length > MAX_LENGTH) {
      throw new InvalidCredentialIdError(
        `Credential id must be 1..${String(MAX_LENGTH)} base64url chars`,
      );
    }
    return new CredentialId(raw);
  }

  toString(): string {
    return this.value;
  }

  equals(other: CredentialId): boolean {
    return this.value === other.value;
  }

  toJSON(): string {
    return this.value;
  }
}
