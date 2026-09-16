import type { HistoryEntry } from "./history-entry.vo";
import type { Profile } from "./profile.entity";
import type { IUnpersisted } from "~/backend/domain/shared";

export interface IProfileCommandRepository {
  /**
   * プロフィールを upsert する。行は常に 1 つで、出ていく先と経歴は
   * 差分を取らずに入れ直す (書き手が並べ替えたときに古い並びが残らない)。
   *
   * 消してから入れるところまでを 1 つの batch にまとめること。途中で落ちて
   * 「名前はあるのに出ていく先が空」の姿が表に出ないようにするため。
   *
   * ⚠️ **経歴を別の引数で受けるのは、`Profile` が持っていないから** (読む頻度が違うので
   * 集約から外してある。`profile.entity.ts`)。**それでも書き込みは一緒**でなければ
   * ならないので、口を 2 つに割らずにここで受ける。割ると batch をまたぐ。
   */
  upsert(profile: Profile<IUnpersisted>, history: readonly HistoryEntry[]): Promise<void>;

  /** プロフィールを削除する (コンテンツリポジトリから `profile.md` が消えたとき用)。 */
  delete(): Promise<void>;
}
