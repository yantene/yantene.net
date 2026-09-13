import type { IValueObject } from "~/backend/domain/shared";
import { randomBase64Url } from "~/lib/base64url";

/** 128 bit を base64url にした 22 文字。 */
const pattern = /^[\w-]{22}$/;

const REQUEST_ID_BYTES = 16;

/**
 * リンクを頼んだブラウザを指す乱数 (ADR 0039)。
 *
 * cookie に預け、トークンの行にも書いておく。**同じブラウザから踏まれたことが
 * 分かれば、確認の 1 枚を飛ばせる。** 一致しないとき (別の端末) は確認を出すだけで、
 * 入れなくなるわけではない。守りの本体はトークンのほうにある。
 */
export class SignInRequestId implements IValueObject<SignInRequestId> {
  private constructor(private readonly value: string) {}

  static issue(): SignInRequestId {
    return new SignInRequestId(randomBase64Url(REQUEST_ID_BYTES));
  }

  /** 読めなければ undefined。cookie から読むので、形が違えば「持っていない」に倒す。 */
  static parse(raw: string): SignInRequestId | undefined {
    return pattern.test(raw) ? new SignInRequestId(raw) : undefined;
  }

  toString(): string {
    return this.value;
  }

  equals(other: SignInRequestId): boolean {
    return this.value === other.value;
  }

  toJSON(): string {
    return this.value;
  }
}
