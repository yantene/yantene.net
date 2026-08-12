/**
 * 著作権表示などに出す「今年」。**必ず loader から呼ぶこと。**
 *
 * Cloudflare Workers は I/O の外 — モジュールのトップレベル評価時 — の時刻を Unix epoch 0
 * に固定する。そのためモジュールスコープで年を求めると、SSR は毎回 1970 年を返す。画面上は
 * hydration でクライアントの値に差し替わるので気づきにくいが、JS を実行しない閲覧者と
 * クローラーには 1970 年がそのまま見え、差し替えは全ページで hydration mismatch を出す。
 *
 * リクエストの中 (loader) で呼べば実時刻が返る。描画のたびに読む形にしないのは、SSR
 * (Workers は UTC) と閲覧者のローカル時刻とで年が食い違う年末年始の数時間に、同じ
 * mismatch が残るため。loader が決めた 1 つの年を props で描画へ渡す。
 */
export function currentYear(): number {
  return new Date().getFullYear();
}
