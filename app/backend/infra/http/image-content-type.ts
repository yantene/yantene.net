/*
 * 外から取ってきた画像を、自分のところに写してよいかの判断。
 *
 * リンクカードの OG 画像と、Webmention の著者アイコンが同じ判断をする。片方だけを
 * 緩められる置き方にしない。
 */

/*
 * 写してよい画像の種類。
 *
 * **SVG は受け入れない。** `<img>` で描く限りスクリプトは動かないが、写した先は自分の
 * オリジンなので、配信 URL を直接開かれるとスクリプト入りの SVG が自分のオリジンで
 * 実行されうる。絵ひとつのために穴を開ける理由がない。
 */
const allowedImageTypes: ReadonlySet<string> = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

/** Content-Type からパラメータ (charset 等) を落として型だけにする。 */
export function mediaTypeOf(contentType: string): string {
  return (contentType.split(";", 1)[0] ?? "").trim().toLowerCase();
}

/** 写してよい画像か。判断は Content-Type だけで行う (中身は覗かない)。 */
export function isAllowedImageType(contentType: string): boolean {
  return allowedImageTypes.has(mediaTypeOf(contentType));
}
