import type { WebmentionUrl } from "./webmention-url.vo";
import type { Webmention } from "./webmention.entity";
import type { ArticleId } from "~/backend/domain/article";
import type { IUnpersisted } from "~/backend/domain/shared";

/**
 * 検証を通った Webmention を書き込む。
 *
 * Webmention は再送で更新される仕様なので、書き込みは常に「いまの姿を置く」形にする。
 * 同じ (記事, source) を重ねて積まない。
 */
export interface IWebmentionCommandRepository {
  /**
   * (記事, source) をキーに upsert する。
   *
   * 初めて受け取った時刻は保ったまま、種別・著者・本文・公開日時を差し替える。
   * 送り手が記事を書き直して「返信」から「ただの言及」に変わることもあるため、
   * 種別まで含めて置き換える。
   */
  upsert(webmention: Webmention<IUnpersisted>): Promise<Webmention>;

  /**
   * その source からの Webmention を落とす。
   *
   * 送り元からリンクが消えた (または記事ごと消えた) ときに呼ぶ。Webmention は
   * 「いまリンクされているか」を映すものなので、消えたら残さない。
   */
  deleteBySource(articleId: ArticleId, source: WebmentionUrl): Promise<void>;
}
