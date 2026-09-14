import type { Profile } from "./profile.entity";

/**
 * プロフィールの読み取り口。
 *
 * **記事のように読み手向けと管理者向けに分けていない。** プロフィールに status が
 * 無いためで、置いてあるものはそのまま読み手に出る。隠したい版は push しなければよい。
 */
export interface IProfileQueryRepository {
  /** プロフィールを引く。まだ同期していなければ undefined。 */
  find(): Promise<Profile | undefined>;
  /** 保存済みのリビジョン識別子だけを引く (refresh の変更検出用)。 */
  findSourceHash(): Promise<string | undefined>;
}
