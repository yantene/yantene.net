import type { IValueObject } from "~/backend/domain/shared";

/**
 * WebAuthn の儀式 1 回ぶんのチャレンジ。
 *
 * **推測できないことが要件。** 当てられると、認証器に署名させた応答を後から組み立て
 * られる。WebAuthn は 16 バイト以上を求めており、ここでは 32 バイト取る。
 *
 * 保存する側はこの値そのものを鍵にする。追加の識別子を配って cookie で運ぶ形にすると、
 * 運ぶものが 1 つ増えるだけで守りは変わらない (どちらも当てられないことが拠りどころ)。
 */

const CHALLENGE_BYTES = 32;

/** 32 バイトを base64url にした 43 文字。 */
const pattern = /^[\w-]{43}$/;

export class InvalidChallengeError extends Error {
  readonly name = "InvalidChallengeError";
}

export class Challenge implements IValueObject<Challenge> {
  private constructor(private readonly value: string) {}

  /** 新しいチャレンジを発行する。 */
  static issue(): Challenge {
    const bytes = crypto.getRandomValues(new Uint8Array(CHALLENGE_BYTES));
    const binary = String.fromCodePoint(...bytes);
    return new Challenge(
      btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", ""),
    );
  }

  /**
   * ブラウザが返してきた値をチャレンジとして検証する。
   *
   * 形が違えば送出する。保存先の鍵になる値なので、長さの決まらない文字列をそのまま
   * 鍵にしない。
   */
  static create(raw: string): Challenge {
    if (!pattern.test(raw)) {
      throw new InvalidChallengeError("Challenge must be 43 base64url chars");
    }
    return new Challenge(raw);
  }

  toString(): string {
    return this.value;
  }

  equals(other: Challenge): boolean {
    return this.value === other.value;
  }

  toJSON(): string {
    return this.value;
  }
}

/** どの儀式のために発行したチャレンジか。 */
export type CeremonyPurpose = "registration" | "authentication";

/**
 * チャレンジの寿命 (秒)。
 *
 * 認証器に触れるまでの間だけ持てばよい。長くすると、盗み見た応答を使える窓が延びる。
 */
export const CEREMONY_LIFETIME_SECONDS = 300;

/** 発行したチャレンジ 1 回ぶん。使ったら消す。 */
export interface PasskeyCeremony {
  readonly challenge: Challenge;
  readonly purpose: CeremonyPurpose;
}
