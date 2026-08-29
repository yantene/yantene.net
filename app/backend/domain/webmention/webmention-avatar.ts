import type { WebmentionUrl } from "./webmention-url.vo";

/** 識別子に使う長さ (16 進の文字数)。128 bit あれば衝突は起こらない。 */
const ID_LENGTH = 32;

/**
 * 著者アイコンの URL から、写した先の識別子を導く。
 *
 * 相手のドメインからは読み込めない (`img-src 'self' data:`) ので、取得したものを
 * 自分のところに写して `/api/v1/webmentions/avatars/<id>` から配る。URL そのものを
 * パスに埋められないため、ダイジェストを取る。
 *
 * 同じアイコンを使う人からの mention が増えても、写しは 1 つで済む。
 *
 * 短いハッシュを使わないのは、衝突すると**別人の顔を出してしまう**ため。
 */
export async function webmentionAvatarIdFor(photo: WebmentionUrl): Promise<string> {
  const bytes = new TextEncoder().encode(photo.toString());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, ID_LENGTH);
}

/** 写したアイコン 1 枚。 */
export interface WebmentionAvatar {
  readonly bytes: Uint8Array;
  readonly contentType: string;
}

/** 写したアイコンを置いておく先。キーは {@link webmentionAvatarIdFor} の値。 */
export interface IWebmentionAvatarCache {
  put(id: string, avatar: WebmentionAvatar): Promise<void>;
  get(id: string): Promise<WebmentionAvatar | undefined>;
}

/**
 * 著者アイコンを自分のところへ写すポート。
 *
 * **写せなくても mention は保存する。** 相手のアイコンが落ちていることは異常ではないので、
 * throw せず undefined を返す (顔の無い mention として出る)。
 */
export interface IWebmentionAvatarMirror {
  mirror(photo: WebmentionUrl): Promise<string | undefined>;
}
