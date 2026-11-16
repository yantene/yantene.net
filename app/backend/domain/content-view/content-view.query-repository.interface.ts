import type { ContentRef } from "~/backend/domain/shared";

export interface IContentViewQueryRepository {
  /**
   * よく読まれている順に、コンテンツを指す参照を返す。種別は混ざる。
   *
   * 対数は単調なので、保存した列をそのまま降順に並べれば人気順になる。読み出したあとに
   * 重みをかけ直す必要はない。基準日も重みの付け方も種別によらないので、種別をまたいで
   * そのまま比べてよい。
   *
   * まだ読まれていないものも含む。出発点が投稿日の重みなので、読まれていないもの同士
   * でも新しいものが上に来る。
   *
   * 返すのは、読み手に差し出してよいものだけ。
   */
  listPopular(limit: number): Promise<readonly ContentRef[]>;
}
