import { describe, expect, it } from "vitest";
import { isLikelyBot } from "./view-recording";

const chrome =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const safariIos =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const firefox = "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0";

describe("isLikelyBot", () => {
  it("ふつうのブラウザは人として数える", () => {
    expect(isLikelyBot(chrome)).toBe(false);
    expect(isLikelyBot(safariIos)).toBe(false);
    expect(isLikelyBot(firefox)).toBe(false);
  });

  it("検索エンジンのクローラーを弾く", () => {
    expect(
      isLikelyBot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"),
    ).toBe(true);
    expect(
      isLikelyBot("Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)"),
    ).toBe(true);
    expect(isLikelyBot("Mozilla/5.0 (compatible; Yahoo! Slurp)")).toBe(true);
  });

  it("リンクを展開しに来る相手を弾く", () => {
    expect(isLikelyBot("facebookexternalhit/1.1")).toBe(true);
    expect(isLikelyBot("Mozilla/5.0 (compatible; Discordbot/2.0)")).toBe(true);
    expect(isLikelyBot("WhatsApp/2.19.81 A")).toBe(true);
  });

  it("手元から叩く道具を弾く", () => {
    expect(isLikelyBot("curl/8.5.0")).toBe(true);
    expect(isLikelyBot("Wget/1.21.4")).toBe(true);
    expect(isLikelyBot("python-requests/2.31.0")).toBe(true);
  });

  it("計測・監視の類を弾く", () => {
    expect(
      isLikelyBot("Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120.0.0.0 Safari/537.36"),
    ).toBe(true);
    expect(isLikelyBot("Chrome-Lighthouse")).toBe(true);
  });

  it("名乗らない相手は人ではないとみなす", () => {
    // ふつうのブラウザは必ず名乗るので、無記名は数えない。
    expect(isLikelyBot(null)).toBe(true);
    expect(isLikelyBot("")).toBe(true);
    expect(isLikelyBot(" ".repeat(3))).toBe(true);
  });

  it("大文字小文字は問わない", () => {
    expect(isLikelyBot("SomeCrawler/1.0")).toBe(true);
    expect(isLikelyBot("somecrawler/1.0")).toBe(true);
  });
});
