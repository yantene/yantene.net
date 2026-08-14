/** ノートのコンテンツ配信 (アセット・原文 Markdown) に付ける max-age。 */
const MAX_AGE_SECONDS = 3600;

/**
 * R2 キャッシュから配信するコンテンツの Cache-Control を決める。
 *
 * BASIC 認証が有効な環境 (staging) では共有キャッシュに載せると認証バリアを迂回して
 * 未認証クライアントへ配信され得るため `private` にし、それ以外 (production 等) では
 * CDN 等でキャッシュできるよう `public` にする。
 * refresh で内容が更新され得るため immutable にはしない。
 */
export function contentCacheControlFor(env: Env): string {
  const isBasicAuthEnabled =
    env.BASIC_AUTH_USER !== undefined && env.BASIC_AUTH_PASS !== undefined;
  const scope = isBasicAuthEnabled ? "private" : "public";
  return `${scope}, max-age=${String(MAX_AGE_SECONDS)}`;
}

/**
 * Accept で表現が分かれる URL (`/notes/<slug>`) の Markdown 応答に付ける Cache-Control。
 *
 * Cloudflare のエッジは `Accept-Encoding` 以外の `Vary` をキャッシュキーに含めないため、
 * `Vary: Accept` を出しても共有キャッシュが表現を取り違え得る (ブラウザに原文が、
 * 機械に HTML が配られる)。`private` を固定で置いて共有キャッシュへの保存そのものを
 * 止める。環境に依らないのは、この危険が環境に依らないため
 * (`contentCacheControlFor` が BASIC 認証で振り分けているのとは別の理由)。
 */
export const NEGOTIATED_CONTENT_CACHE_CONTROL = `private, max-age=${String(MAX_AGE_SECONDS)}`;
