import type { i18n } from "i18next";
import { createI18nInstance } from "~/lib/i18n/init";
import { defaultLocale, type SupportedLocale } from "~/lib/i18n/locale";
import { resolveLocale } from "~/lib/i18n/resolve-locale";

/**
 * このリクエストの表示ロケール。決められなければ既定に倒す。
 *
 * ここは entry.server.tsx の助走、つまり **どの ErrorBoundary の外**で走る。ルートの
 * loader が投げれば React Router がそのルートの ErrorBoundary を描くが、助走で投げると
 * 全ルートが素の 500 になる。cookie を復号していた頃は `Cookie: locale=%` を送るだけで
 * それが起き、cookie は消すまで送られ続けるので開けなくなっていた (#309)。
 *
 * ロケールは読み手のヘッダーから導く値で、**中身をこちらで決められない。** だから
 * 「決められなかった」を異常として扱わず、既定に倒して描き進める。倒したことは残す
 * (静かに劣化させない)。
 */
function localeOf(request: Request): SupportedLocale {
  try {
    return resolveLocale(request);
  } catch (error) {
    console.error("failed to resolve the locale; falling back", error);
    return defaultLocale;
  }
}

/**
 * このリクエストの翻訳を用意する。
 *
 * **握るのはロケールを決めるところだけ。** 翻訳そのものを用意できないのはこちら側の
 * 異常で、握って既定で描き直すと、日本語を求めた読み手に英語のページを黙って返し続ける
 * ことになる (気づく手掛かりはログ 1 行だけ)。ここは投げる。
 */
export async function prepareI18n(request: Request): Promise<i18n> {
  return createI18nInstance(localeOf(request));
}
