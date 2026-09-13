/**
 * ログインの経路と、フォームの欄の名前 (ADR 0039)。
 *
 * **受け口 (backend/handlers/auth/sign-in.handler.ts) と画面の両方が読む。** 受け口の
 * 側に置くと、画面がそれを読むために Hono ごとクライアントの束に引きずり込むことに
 * なる。どちらにも属さない値なので、両方から見えるここに置く (ロケールの
 * `localePath` と同じ形)。
 */

/** メールアドレスを打つ画面と、その送り先。 */
export const signInPath = "/sign-in";

/** 送ったことを伝える画面。**送れたかどうかは言わない。** */
export const signInSentPath = "/sign-in/sent";

/** 別の端末で踏んだ人に、押してもらう画面と、その送り先。 */
export const signInConfirmPath = "/sign-in/confirm";

/** メールのリンクの行き先。 */
export const signInCallbackPath = "/sign-in/callback";

/** ログアウトの受け口。 */
export const signOutPath = "/sign-out";

/** リンクに載るトークンの欄の名前。 */
export const signInTokenParam = "token";

/** アドレスを打つ欄の名前。 */
export const signInEmailField = "email";

/**
 * 打ち間違いを伝えるためのクエリ。
 *
 * **「登録済みか」ではなく「アドレスの形か」しか言わない。** 誰がこのサイトに
 * 入れるのかは、ここからも他のどこからも読み取れないようにする。
 */
export const signInInvalidParam = "invalid";

/** リンクがもう使えないことを伝えるためのクエリ。 */
export const signInExpiredParam = "expired";
