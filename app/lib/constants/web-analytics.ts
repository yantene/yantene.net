/**
 * Cloudflare Web Analytics のビーコン (ADR 0021)。
 *
 * 読み込む先と送り先は、CSP を組む側 (`app/backend/index.ts`) と `<script>` を置く側
 * (`app/frontend/root.tsx`) の両方が見る。片方だけ書き換えるとブラウザが黙ってビーコンを
 * 止め、**数が入らないことにしばらく気づけない**。だから 1 か所に置いて両側から引く。
 */

/**
 * ビーコン本体。
 *
 * CSP の `script-src` にはこの URL を**パスまで**そのまま並べる。ホストだけを許すと
 * static.cloudflareinsights.com に置かれた別のファイルまで通ってしまう。
 */
export const WEB_ANALYTICS_BEACON_SRC = "https://static.cloudflareinsights.com/beacon.min.js";

/**
 * ビーコンの送り先。CSP の `connect-src` に要る。
 *
 * 手で `<script>` を置いた場合はここへ POST する。自ドメインの `/cdn-cgi/rum` へ送るのは
 * Cloudflare がプロキシで自動挿入したときだけで、こちらは nonce の都合で手置きしている
 * (ADR 0021)。
 */
export const WEB_ANALYTICS_REPORT_ORIGIN = "https://cloudflareinsights.com";

/**
 * 計測先のサイトトークン。
 *
 * **秘密ではない。** 読み手に配る HTML にそのまま載る値で、隠す意味がない。secret や
 * wrangler.jsonc の vars に逃がさずここに置いてあるのは、環境ごとの設定漏れという失敗の
 * 形そのものを無くすため。入れ忘れても「ビーコンの無い正常なページ」に見えるだけなので、
 * 数が入っていないと気づくまでの手がかりが何も無い。
 *
 * 値は Cloudflare ダッシュボードの Web Analytics でサイトを追加すると発行される。
 * 形が違えば `web-analytics.test.ts` が落ちる。**それらしい偽の値を置かないこと。**
 * 通ってしまうと、ビーコンだけ飛んで誰も受け取っていない状態が黙って続く。
 *
 * ダッシュボード側のサイトは **「Enable with JS Snippet installation」のままにすること。**
 * 「Enable」に戻すと Cloudflare がプロキシで `<script>` を挿し込み、こちらが置いたタグと
 * 合わせて 2 本になる。どちらも同じ URL なので CSP は止めず、数だけが二重になる。
 */
export const WEB_ANALYTICS_SITE_TOKEN = "85000e4f8ef747ef8b2732ac66d07f25";
