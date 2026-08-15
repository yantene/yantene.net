import type { LinkCardAsset } from "./link-card-asset";
import type { LinkCardUrl } from "./link-card-url.vo";

/**
 * 絵をどうしたか。取れなかったことを取れたことと同じ形で返すための入れ物。
 *
 * 「取りに行けなかった (missed)」と「載せる絵が無い (absent)」を分けて返す。カードの
 * 期限がこの区別で変わるためで、畳んでしまうと絵を持たない相手まで短い間隔で
 * 叩き直すことになる。状態の名前はドメインの LinkCardImageState と揃えてある。
 */
export type FetchedLinkCardImage =
  | { readonly state: "stored"; readonly asset: LinkCardAsset }
  | { readonly state: "absent" }
  | { readonly state: "missed" };

/** リンク先から読み取ったカードの材料。 */
export interface FetchedLinkCard {
  /** OGP の og:title。無ければ `<title>` で代える。 */
  readonly title: string;
  readonly description: string | undefined;
  readonly siteName: string | undefined;
  readonly image: FetchedLinkCardImage;
  /**
   * favicon。**こちらは取り逃しを区別しない。**
   *
   * rel=icon が書かれていない相手には慣例の `/favicon.ico` を試すので、置いていない
   * サイトでは毎回取れない。これを取り逃しに数えると、そういう相手のカードが
   * 短い期限で永久に取り直され続ける。
   */
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
   * (ADR 0014)。
   */
  fetch(url: LinkCardUrl): Promise<FetchedLinkCard | undefined>;
}
