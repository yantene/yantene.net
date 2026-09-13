/** メールアドレスとして読めない文字列を渡された。 */
export class InvalidEmailAddressError extends Error {
  readonly name = "InvalidEmailAddressError";
}

/** セッション識別子として読めない文字列を渡された。 */
export class InvalidAuthSessionIdError extends Error {
  readonly name = "InvalidAuthSessionIdError";
}

/** マジックリンクのトークンとして読めない文字列を渡された。 */
export class InvalidSignInTokenError extends Error {
  readonly name = "InvalidSignInTokenError";
}

/**
 * この環境には入れるアドレスが 1 つも無い (`ADMIN_EMAIL` が空)。
 *
 * **黙って全員を通さない** (secure by default)。設定の抜けはログインできないことで
 * しか見えないので、記録に残せるよう型で区別する。
 */
export class SignInUnavailableError extends Error {
  readonly name = "SignInUnavailableError";
}
