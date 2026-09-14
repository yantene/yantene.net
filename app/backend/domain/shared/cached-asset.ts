/**
 * キャッシュされた画像アセット。
 *
 * 記事の絵もプロフィールの顔写真も、コンテンツリポジトリから写して R2 に置き、アセット API が
 * この形で読み出して配信する。置き場所が集約ごとに違うだけで、運ぶものは同じ。
 */
export interface CachedAsset {
  readonly bytes: Uint8Array;
  readonly contentType: string;
}
