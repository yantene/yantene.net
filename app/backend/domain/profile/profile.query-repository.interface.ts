import type { HistoryEntry } from "./history-entry.vo";
import type { Profile } from "./profile.entity";

export interface IProfileQueryRepository {
  /**
   * プロフィールを引く。まだ同期されていなければ undefined。
   *
   * ⚠️ **経歴は含まない。** ここはトップと**全記事ページ**が通る経路なので、読み捨てる
   * 行を引かせない。経歴が要るのは `/about` だけで、`findHistory` が別に引く。
   */
  find(): Promise<Profile | undefined>;

  /**
   * 経歴を引く。書いていなければ空。
   *
   * **`/about` だけが呼ぶ。** 呼ぶ側が別なので、読めない経歴の行があってもトップと
   * 記事ページの h-card は巻き添えにならない。
   */
  findHistory(): Promise<readonly HistoryEntry[]>;

  /**
   * コンテンツリポジトリのリビジョン識別子だけを引く。refresh の変更検出に使う。
   *
   * 中身を組み立てずに済ませるためにあるので、無ければ undefined を返す。
   */
  findSourceHash(): Promise<string | undefined>;
}
