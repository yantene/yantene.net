import type { Profile } from "./profile.entity";

export interface IProfileQueryRepository {
  /** プロフィールを引く。まだ同期されていなければ undefined。 */
  find(): Promise<Profile | undefined>;

  /**
   * コンテンツリポジトリのリビジョン識別子だけを引く。refresh の変更検出に使う。
   *
   * 中身を組み立てずに済ませるためにあるので、無ければ undefined を返す。
   */
  findSourceHash(): Promise<string | undefined>;
}
