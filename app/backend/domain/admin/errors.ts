/**
 * 管理者の認証にまつわるドメインエラー。
 *
 * HTTP のステータスへの対応付けは handler 層が行う (ドメインに HTTP を持ち込まない)。
 *
 * **どれも読み手には同じ応答を返す。** 「その credential は知らない」と
 * 「署名が違う」を区別して返すと、どの credential が登録済みかを外から数えられる。
 * 型を分けてあるのは記録に残す側の都合で、応答の出し分けのためではない。
 */
export class AdminAuthError extends Error {
  readonly name: string = "AdminAuthError";
}

/** チャレンジが見つからない・期限切れ・すでに使われた。 */
export class CeremonyExpiredError extends AdminAuthError {
  readonly name = "CeremonyExpiredError";
}

/** 儀式の種類が発行したときと違う (登録用のチャレンジで認証しようとした等)。 */
export class CeremonyMismatchError extends AdminAuthError {
  readonly name = "CeremonyMismatchError";
}

/** 応答の中身が WebAuthn として読めない、または検証に落ちた。 */
export class PasskeyVerificationError extends AdminAuthError {
  readonly name = "PasskeyVerificationError";
}

/** 知らない credential での認証。 */
export class UnknownCredentialError extends AdminAuthError {
  readonly name = "UnknownCredentialError";
}

/** すでに登録済みの credential をもう一度登録しようとした。 */
export class CredentialAlreadyRegisteredError extends AdminAuthError {
  readonly name = "CredentialAlreadyRegisteredError";
}

/**
 * いまこの要求は登録を許されていない。
 *
 * 資格情報が 1 本も無いときは登録用の secret を示した要求だけが、1 本でもあるときは
 * ログイン済みの要求だけが登録できる (ADR 0036)。
 */
export class RegistrationNotAllowedError extends AdminAuthError {
  readonly name = "RegistrationNotAllowedError";
}

/** 登録の経路そのものが閉じている (`ADMIN_REGISTRATION_TOKEN` が無い)。 */
export class RegistrationClosedError extends AdminAuthError {
  readonly name = "RegistrationClosedError";
}
