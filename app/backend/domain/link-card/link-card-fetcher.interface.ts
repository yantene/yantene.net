import type { LinkCardAsset } from "./link-card-asset";
import type { LinkCardUrl } from "./link-card-url.vo";

/** リンク先から読み取ったカードの材料。 */
export interface FetchedLinkCard {
  /** OGP の og:title。無ければ `<title>` で代える。 */
  readonly title: string;
  readonly description: string | undefined;
  readonly siteName: string | undefined;
  readonly image: LinkCardAsset | undefined;
  readonly favicon: LinkCardAsset | undefined;
}

/**
 * リンク先を読みに行くポート。
 *
 * 見るのは OGP だけで oEmbed は使わない。oEmbed が返すのはプロバイダの埋め込み HTML
 * (多くは iframe) で、採用すると `frame-src` を相手ごとに広げ続けることになる
 * (ADR 0007)。カードを自前で描く以上、マークアップを自分で持てる OGP で足りる。
 */
export interface ILinkCardFetcher {
  /**
   * リンク先の OGP を読む。取れなければ undefined を返す。
   *
   * **相手が落ちていること・OGP が無いことは異常ではないので throw しない。**
   * このサイトの既定は fail-loud だが、外部サイトへの依存はその例外に当たる
   * (ADR 0013)。
   */
  fetch(url: LinkCardUrl): Promise<FetchedLinkCard | undefined>;
}
