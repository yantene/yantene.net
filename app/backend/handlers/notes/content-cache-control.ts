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
