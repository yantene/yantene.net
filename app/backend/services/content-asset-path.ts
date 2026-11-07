/**
 * 記事・プロフィール・作品の脇に置いたファイルのうち、同期してよいものかどうか。
 *
 * `relativePath` はアセットの置き場 (`articles/<slug>/`、`profile/`、`works/<slug>/`) から
 * 見た相対パス。**`_` で始まる要素を 1 つでも含むものは同期しない** (#559)。どの深さでも
 * 同じで、`_materials/interview.md` も `img/_draft.png` も落ちる。
 *
 * 書き手は執筆の材料 (取材の問いと答え、骨組み) を記事の隣に置いてコミットで残す。材料には
 * 本人の本音や他人の発言が入るので、R2 に写さず、合成ハッシュにも入れない。落とすのは
 * 配信の時点ではなく同期の時点。R2 に入れてしまうと、別の経路から漏れる余地が残る。
 */
export function isSyncedAssetPath(relativePath: string): boolean {
  return !relativePath.split("/").some((segment) => segment.startsWith("_"));
}
