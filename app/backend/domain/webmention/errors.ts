/**
 * 受け取れない Webmention。
 *
 * 同期段 (送り手を待たせている間) の検証で投げる。HTTP への写像は handler の責務なので、
 * ここには status を持たせない。handler はこの系統をまとめて 400 に写す。
 */
export class WebmentionRejectedError extends Error {}

/** source / target が URL でない、または http・https 以外。 */
export class InvalidWebmentionUrlError extends WebmentionRejectedError {
  readonly name = "InvalidWebmentionUrlError";
}

/** source と target が同じ。自分自身への言及は言及ではない。 */
export class SameSourceAndTargetError extends WebmentionRejectedError {
  readonly name = "SameSourceAndTargetError";
}

/** target がこのサイトのノート URL (`/notes/<slug>`) でない。 */
export class TargetNotOnThisSiteError extends WebmentionRejectedError {
  readonly name = "TargetNotOnThisSiteError";
}

/** source がこのサイト自身。自分で自分に送る mention は受けない。 */
export class SelfMentionNotAcceptedError extends WebmentionRejectedError {
  readonly name = "SelfMentionNotAcceptedError";
}

/** target のスラグに対応するノートが無い。 */
export class TargetNoteNotFoundError extends WebmentionRejectedError {
  readonly name = "TargetNoteNotFoundError";
}

/** 種別として解釈できない文字列。保存済みの行を読み戻すときの破損検知に使う。 */
export class InvalidWebmentionTypeError extends Error {
  readonly name = "InvalidWebmentionTypeError";
}
