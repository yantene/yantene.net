import type { IValueObject } from "~/backend/domain/shared";
import { randomBase64Url } from "~/lib/base64url";
import { InvalidSignInTokenError } from "./errors";

/** 256 bit を base64url にした 43 文字。 */
const pattern = /^[\w-]{43}$/;

const TOKEN_BYTES = 32;

/**
 * マジックリンクに載る 1 回きりの秘密 (ADR 0039)。
 *
 * **この値そのものは保存しない。** 置き場には SHA-256 を通した値だけを入れ、
 * 生の値は送ったメールの中にしか残らないようにする。元が 256 bit の乱数なので、
 * 合言葉のような伸長は要らない。
 */
export class SignInToken implements IValueObject<SignInToken> {
  private constructor(private readonly value: string) {}

  static issue(): SignInToken {
    return new SignInToken(randomBase64Url(TOKEN_BYTES));
  }

  static create(raw: string): SignInToken {
    if (!pattern.test(raw)) {
      throw new InvalidSignInTokenError("Sign-in token must be 43 base64url chars");
    }
    return new SignInToken(raw);
  }

  /** 読めなければ undefined。外から来る値を受ける入口で使う。 */
  static parse(raw: string): SignInToken | undefined {
    try {
      return SignInToken.create(raw);
    } catch (error) {
      if (error instanceof InvalidSignInTokenError) return undefined;
      throw error;
    }
  }

  toString(): string {
    return this.value;
  }

  equals(other: SignInToken): boolean {
    return this.value === other.value;
  }

  /**
   * ログに出さない。
   *
   * `JSON.stringify` に渡ると `console.error({ token })` のような書き方で観測記録に
   * 生の値が残る。**残った時点でそのリンクは秘密でなくなる。**
   */
  toJSON(): string {
    return "[redacted]";
  }
}
