/**
 * カードに添える画像 1 枚ぶん。OG 画像と favicon の両方に使う。
 *
 * 相手のドメインから直接読み込むことはできない (`img-src 'self' data:`) ので、
 * 取得したものを自分のところに写して配る。
 */
export interface LinkCardAsset {
  readonly bytes: Uint8Array;
  readonly contentType: string;
}
