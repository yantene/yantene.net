import type { Profile } from "./profile.entity";

/** プロフィールの書き込み口。行は 1 つしか無いので、slug のような宛先を取らない。 */
export interface IProfileCommandRepository {
  /** プロフィールを保存する (既にあれば上書き)。 */
  save(profile: Profile): Promise<void>;
  /** プロフィールを消す。`profile.md` がコンテンツリポジトリから消えたとき用。 */
  delete(): Promise<void>;
}
