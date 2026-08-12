/**
 * 描画に使う「いまの年」。全ページの loader がこれを返し、フッターの著作権表示へ渡す。
 *
 * loader が決めた値は SSR の HTML と一緒にクライアントへ運ばれ、hydration でも
 * そのまま使われる。つまりサーバーとブラウザで必ず同じ年になる。
 */
export interface CurrentYearData {
  readonly currentYear: number;
}

/**
 * いまの年 (UTC) を返す。
 *
 * 必ず loader のような I/O の内側から呼ぶこと。Cloudflare Workers は I/O の外
 * (モジュールのトップレベル評価時) の時刻を Unix epoch 0 に固定するため、
 * モジュールスコープで年を求めると本番の SSR だけが 1970 年になる (#156)。
 * ローカルの workerd では再現しないので、実装時には気づけない。
 *
 * 求めた年は描画側へ props で渡す。コンポーネントの中で時計を読むと 1970 年は消えるが、
 * SSR (Workers は UTC) と閲覧者のローカル時刻で年が食い違う年末年始の数時間に
 * hydration mismatch が残る。
 */
export function resolveCurrentYear(): number {
  return new Date().getFullYear();
}
