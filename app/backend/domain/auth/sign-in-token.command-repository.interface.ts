import type { Temporal } from "@js-temporal/polyfill";
import type { EmailAddress } from "./email-address.vo";
import type { SignInRequestId } from "./sign-in-request-id.vo";
import type { SignInToken } from "./sign-in-token.vo";

/**
 * マジックリンクの寿命 (分)。
 *
 * トークンを `GET` で使い切らない形にした以上、長く置く理由が無い (ADR 0039)。
 * 受け取った人が読んで押すまでの間だけ持てばよい。
 */
export const SIGN_IN_TOKEN_LIFETIME_MINUTES = 15;

export interface IssueSignInTokenParams {
  readonly token: SignInToken;
  readonly email: EmailAddress;
  /** リンクを頼んだブラウザ。踏んだのが同じブラウザなら確認を飛ばす。 */
  readonly requestId: SignInRequestId;
  readonly issuedAt: Temporal.Instant;
}

export interface ConsumeSignInTokenOptions {
  /**
   * これを渡すと、**行に書かれた値と一致したときだけ**使い切る。
   *
   * 一致しなければ行は残る。`GET` の近道で外したときに、確認からやり直せる。
   */
  readonly requestId?: SignInRequestId;
}

export interface ISignInTokenCommandRepository {
  /** 発行して置く。期限切れの行の掃除もここで済ませる。 */
  issue(params: IssueSignInTokenParams): Promise<void>;

  /**
   * 引き当てて消す。使えなければ undefined。
   *
   * **引き当てと削除は 1 手で行うこと** (ADR 0039)。分けると、同じリンクを同時に
   * 2 回踏まれたときに両方が通る。
   */
  consume(
    token: SignInToken,
    at: Temporal.Instant,
    options?: ConsumeSignInTokenOptions,
  ): Promise<EmailAddress | undefined>;
}
