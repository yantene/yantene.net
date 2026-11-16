import type { SlideSlug } from "./slide-slug.vo";
import type { Slide } from "./slide.entity";
import type { IUnpersisted } from "~/backend/domain/shared";

export interface ISlideCommandRepository {
  /**
   * スライドのメタデータを slug をキーに upsert する。
   * refresh がコンテンツリポジトリの内容で D1 を同期するための操作。
   */
  upsert(slide: Slide<IUnpersisted>): Promise<void>;

  /** slug のスライドを削除する (コンテンツリポジトリから消えたスライドの掃除に使う)。 */
  deleteBySlug(slug: SlideSlug): Promise<void>;
}
