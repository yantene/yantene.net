import type { i18n } from "i18next";
import type { SupportedLocale } from "~/lib/i18n/locale";
import { createI18nInstance } from "~/lib/i18n/init";

/**
 * このリクエストの翻訳を用意する。
 *
 * **ロケールは受け取るだけで、ここでは決めない。** 決めるのは workers/app.ts で、
 * 1 リクエストにつき 1 回きり (#313)。決められなかったときに既定へ倒す判断も
 * あちら側にある (resolveLocaleOrDefault)。
 *
 * **翻訳そのものを用意できないのは握らない。** こちら側の異常で、握って既定で描き直すと、
 * 日本語を求めた読み手に英語のページを黙って返し続けることになる (気づく手掛かりは
 * ログ 1 行だけ)。ここは投げる。
 */
export async function prepareI18n(locale: SupportedLocale): Promise<i18n> {
  return createI18nInstance(locale);
}
