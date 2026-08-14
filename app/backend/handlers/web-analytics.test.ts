import { describe, expect, it } from "vitest";
import { resolveWebAnalyticsBeacon } from "~/backend/handlers/web-analytics";
import {
  WEB_ANALYTICS_BEACON_SRC,
  WEB_ANALYTICS_SITE_TOKEN,
} from "~/lib/constants/web-analytics";

/**
 * 閲覧の計測 (ADR 0021)。
 *
 * ビーコンは黙って落ちる類の仕掛けである。CSP が止めても、トークンが偽でも、ページは
 * 何事もなく出る。気づく手がかりが「数が入らない」しかないので、載る条件と載せる値を
 * ここで固定する。
 */
describe("resolveWebAnalyticsBeacon", () => {
  function env(appEnv: string): Env {
    return { APP_ENV: appEnv } as unknown as Env;
  }

  it("does not measure in development", () => {
    // 手元の開き直しが本番の数に混ざらないようにする。
    expect(resolveWebAnalyticsBeacon(env("development"))).toBeNull();
  });

  it("measures in staging as well as production", () => {
    /*
     * staging を外さないのは、CSP が付くのが development 以外だけだから (ADR 0007)。
     * ここで外すと、外部スクリプトを 1 つ足したこの変更を production に出すまで
     * 試せなくなる。
     */
    for (const appEnv of ["staging", "production"]) {
      expect(resolveWebAnalyticsBeacon(env(appEnv))).not.toBeNull();
    }
  });

  it("loads the beacon from the URL that the CSP allows", () => {
    // CSP (app/backend/index.ts) と同じ定数から引いていること。ずれるとブラウザが止める。
    expect(resolveWebAnalyticsBeacon(env("production"))?.src).toBe(
      WEB_ANALYTICS_BEACON_SRC,
    );
  });

  it("passes the site token through data-cf-beacon", () => {
    const config = resolveWebAnalyticsBeacon(env("production"))?.config ?? "";

    expect(JSON.parse(config)).toEqual({ token: WEB_ANALYTICS_SITE_TOKEN });
  });

  it("leaves SPA measurement on (React Router does not reload the page)", () => {
    // beacon は既定で History API を差し替えて遷移を数える。切る指定を足さないこと。
    const config = resolveWebAnalyticsBeacon(env("production"))?.config ?? "";

    // 文字列で探さないこと。サイトトークンに "spa" が現れると意味なく落ちる。
    expect(JSON.parse(config)).not.toHaveProperty("spa");
  });

  /*
   * トークンの形を見張る。プレースホルダのまま出ると、ビーコンだけ飛んで誰も受け取って
   * いない状態が黙って続く。Cloudflare が発行するのは英数 32 文字。
   */
  it("carries a real-looking site token, not a placeholder", () => {
    expect(WEB_ANALYTICS_SITE_TOKEN).toMatch(/^[0-9a-z]{32}$/);
  });
});
