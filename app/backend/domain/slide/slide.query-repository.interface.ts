import type { SlideSlug } from "./slide-slug.vo";
import type { Slide } from "./slide.entity";

export interface ISlideQueryRepository {
  /**
   * 全件を出した日の新しい順 (同じ日は slug 順) で返す。
   *
   * **ページ送りは持たない。** スライドは発表のたびに 1 本増えるもので、数十本に育つのは
   * 何年も先になる。増えたときに切り方を決めればよい (作品と同じ決め)。
   */
  list(): Promise<readonly Slide[]>;

  /** slug で 1 件引く。無ければ undefined。 */
  findBySlug(slug: SlideSlug): Promise<Slide | undefined>;

  /**
   * 全スライドの slug → sourceHash の対応を返す。refresh の変更検出に使う
   * (コンテンツリポジトリのツリーが返すハッシュと突き合わせる)。
   */
  listSourceHashes(): Promise<ReadonlyMap<string, string>>;
}
