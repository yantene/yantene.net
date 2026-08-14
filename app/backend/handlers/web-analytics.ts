import {
  WEB_ANALYTICS_BEACON_SRC,
  WEB_ANALYTICS_SITE_TOKEN,
} from "~/lib/constants/web-analytics";

/** ページの `<head>` に置くビーコンの指定。 */
export interface WebAnalyticsBeacon {
  readonly src: string;
  /**
   * `data-cf-beacon` 属性に入れる JSON 文字列。
   *
   * SSR と hydration で同じ文字列にする必要があるので、描画のたびに組み立てず
   * loader が決めた 1 つを配る。
   */
  readonly config: string;
}

/**
 * ビーコンを載せるかどうかを決める (Composition Root)。
 *
 * development では載せない。手元で開き直したぶんが本番の数に混ざると、流入元を見る目的
 * そのものが濁るため。staging では載せる。CSP は development 以外でしか付かず
 * (ADR 0007)、外部スクリプトを 1 つ足したこの変更は **staging でしか本番同等の条件を
 * 再現できない**。ここで staging を外すと、CSP がビーコンを止めていても production に
 * 出すまで分からなくなる。
 *
 * staging のぶんは同じサイトトークンで混ざるが、ホスト名で切り分けられる (ADR 0021)。
 */
export function resolveWebAnalyticsBeacon(env: Env): WebAnalyticsBeacon | null {
  if (env.APP_ENV === "development") return null;

  return {
    src: WEB_ANALYTICS_BEACON_SRC,
    // SPA の計測は既定で入る (beacon が History API を差し替える)。React Router の
    // ページ遷移は再読み込みを起こさないので、これが無いと最初の 1 枚しか数えられない。
    config: JSON.stringify({ token: WEB_ANALYTICS_SITE_TOKEN }),
  };
}
