import type { CopyrightYears } from "~/backend/handlers/copyright-years";

/** yantene が web で書き始めた年。著作権表示の始点。 */
const FIRST_YEAR = 2003;

/**
 * 著作権表示に出す期間を決める。始点は固定、終点はいまの年。
 *
 * **必ず loader のような I/O の内側から呼ぶこと。** Cloudflare Workers は I/O の外
 * (モジュールのトップレベル評価時) の時刻を Unix epoch 0 に固定するため、そこで年を
 * 求めると本番の SSR だけが 1970 年になる (#156)。ローカルの workerd では再現しないので
 * 実装時には気づけない。`app/module-scope-clock.test.ts` が見張っている。
 *
 * 求めた値は loader から props で描画へ渡す。コンポーネントの中で時計を読むと 1970 年は
 * 消えるが、SSR (Workers は UTC) と閲覧者のローカル時刻で年が食い違う年末年始の数時間に
 * hydration mismatch が残る。
 */
export function resolveCopyrightYears(): CopyrightYears {
  return { from: FIRST_YEAR, to: new Date().getFullYear() };
}
