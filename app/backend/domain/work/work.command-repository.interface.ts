import type { WorkSlug } from "./work-slug.vo";
import type { Work } from "./work.entity";
import type { IUnpersisted } from "~/backend/domain/shared";

export interface IWorkCommandRepository {
  /**
   * 作品のメタデータを slug をキーに upsert する。
   * refresh がコンテンツリポジトリの内容で D1 を同期するための操作。
   *
   * スクリーンショットと関連記事の並びも一緒に入れ替える。**割れた姿を表に出さない**
   * (「名前は新しいのにスクリーンショットは前のまま」を読み手に見せない)。
   */
  upsert(work: Work<IUnpersisted>): Promise<void>;

  /** slug の作品を削除する (コンテンツリポジトリから消えた作品の掃除に使う)。 */
  deleteBySlug(slug: WorkSlug): Promise<void>;
}
