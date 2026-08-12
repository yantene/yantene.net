import type { LinkCardUrl } from "./link-card-url.vo";

/** 識別子に使う長さ (16 進の文字数)。128 bit あれば衝突は起こらない。 */
const ID_LENGTH = 32;

/**
 * URL から安定した識別子を導く。
 *
 * URL そのものを画像の配信パスに埋めることはできない (長さもスラッシュも扱いに困る) ので、
 * ダイジェストを取って `/api/v1/link-cards/<id>/image` の形にする。同じ URL からは常に
 * 同じ id が出るので、D1 の行と R2 のキーを別々に管理しなくてよい。
 *
 * 短いハッシュ (FNV 等) を使わないのは、衝突すると**別のサイトの画像を配ってしまう**ため。
 * 変更検出のハッシュとは要求が違う。
 *
 * `crypto.subtle` は Web 標準の API で、Workers にも Node にもある。特定のインフラに
 * 依存しないのでドメインに置いてよい。
 */
export async function linkCardIdFor(url: LinkCardUrl): Promise<string> {
  const bytes = new TextEncoder().encode(url.toString());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, ID_LENGTH);
}
