import type { Profile } from "./profile.entity";
import type { IUnpersisted } from "~/backend/domain/shared";

export interface IProfileCommandRepository {
  /**
   * プロフィールを upsert する。行は常に 1 つで、出ていく先とライフイベントは
   * 差分を取らずに入れ直す (書き手が並べ替えたときに古い並びが残らない)。
   *
   * 消してから入れるところまでを 1 つの batch にまとめること。途中で落ちて
   * 「名前はあるのに出ていく先が空」の姿が表に出ないようにするため。
   */
  upsert(profile: Profile<IUnpersisted>): Promise<void>;

  /** プロフィールを削除する (コンテンツリポジトリから `profile.md` が消えたとき用)。 */
  delete(): Promise<void>;
}
