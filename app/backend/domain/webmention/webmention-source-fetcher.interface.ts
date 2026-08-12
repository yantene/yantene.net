import type { WebmentionUrl } from "./webmention-url.vo";

/**
 * source を取りに行った結果。
 *
 * 取れなかったことを例外で表さないのは、**相手が落ちているのは異常ではない**から。
 * このサイトの既定は fail-loud だが、外部サイトの可用性はこちらの不具合ではなく、
 * 投げ上げても直せるものが無い。取れなければ「保存しない」だけにして先へ進む。
 */
export type SourceFetchResult =
  /** 取れた。url は転送を追い切ったあとの最終 URL。 */
  | {
      readonly kind: "fetched";
      readonly url: WebmentionUrl;
      readonly html: string;
    }
  /** 送り元の記事が消えている (404 / 410)。保存済みなら落とす。 */
  | { readonly kind: "gone" }
  /** 取れなかった。理由はログに残すだけで、保存も削除もしない。 */
  | { readonly kind: "unavailable"; readonly reason: string };

/**
 * 送り元の記事を取ってくる口。
 *
 * 実装は外部への HTTP になるが、ドメインはそれを知らない。取得にタイムアウトと
 * サイズの上限を課すのは実装側の責務 (どちらも「どう取るか」の話なので)。
 */
export interface IWebmentionSourceFetcher {
  fetch(source: WebmentionUrl): Promise<SourceFetchResult>;
}
