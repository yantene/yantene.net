import type { WorkSlug } from "./work-slug.vo";
import type { Work } from "./work.entity";

export interface IWorkQueryRepository {
  /**
   * 全件を並び順 (`position` の小さい順、同値は slug 順) で返す。
   *
   * **ページ送りは持たない。** 作品は書き手が手で選んで置くもので、数十件に育つ前提が
   * 無い。増えたときに切り方を決めればよく、いま切り口を決めておく理由が無い (ADR 0042)。
   */
  list(): Promise<readonly Work[]>;

  /** slug で 1 件引く。無ければ undefined。 */
  findBySlug(slug: WorkSlug): Promise<Work | undefined>;

  /**
   * 全作品の slug → sourceHash の対応を返す。refresh の変更検出に使う
   * (コンテンツリポジトリのツリーが返すハッシュと突き合わせる)。
   */
  listSourceHashes(): Promise<ReadonlyMap<string, string>>;
}
