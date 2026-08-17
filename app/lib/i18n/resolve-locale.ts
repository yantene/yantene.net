import { readCookieValues } from "~/lib/cookie";
import {
  defaultLocale,
  isSupportedLocale,
  localeCookieName,
  type SupportedLocale,
} from "~/lib/i18n/locale";

/**
 * Cookie ヘッダーから、読める locale を取り出す。無ければ undefined。
 *
 * **名前が一致した最初のものではなく、読める最初のものを返す。** `locale=%; locale=ja`
 * のように同じ名前が並ぶことがあり (ドメインやパスの違う cookie が両方送られる)、
 * 先頭だけを見ると後ろにある正しい値が黙って捨てられる。符号化を解かない理由は
 * {@link readCookieValues} を参照。
 */
function readLocaleCookie(
  cookieHeader: string | null,
): SupportedLocale | undefined {
  return readCookieValues(cookieHeader, localeCookieName).find((value) =>
    isSupportedLocale(value),
  );
}

/**
 * Accept-Language ヘッダーから優先度の高い順に走査し、最初にマッチした
 * SupportedLocale を返す。q 値の重み付けは扱わず、書かれた順 (= 優先順) で判定する。
 */
function parseAcceptLanguage(header: string): SupportedLocale | undefined {
  for (const part of header.split(",")) {
    const tag = part.split(";", 1)[0].trim().toLowerCase().slice(0, 2);
    if (tag.length > 0 && isSupportedLocale(tag)) return tag;
  }
  return undefined;
}

/**
 * リクエストから表示ロケールを決める。locale クッキーを優先し、
 * 無ければ Accept-Language、どちらも無ければ defaultLocale にフォールバックする。
 */
export function resolveLocale(request: Request): SupportedLocale {
  return (
    readLocaleCookie(request.headers.get("Cookie")) ??
    parseAcceptLanguage(request.headers.get("Accept-Language") ?? "") ??
    defaultLocale
  );
}

/**
 * リクエストから表示ロケールを決める。**決められなければ既定に倒す。**
 *
 * 呼ぶのは workers/app.ts、つまり**どの ErrorBoundary の外**。ルートの loader が投げれば
 * React Router がそのルートの ErrorBoundary を描くが、ここで投げると全ルートが素の
 * 500 になる。cookie を復号していた頃は `Cookie: locale=%` を送るだけでそれが起き、
 * cookie は消すまで送られ続けるので開けなくなっていた (#309)。
 *
 * ロケールは読み手のヘッダーから導く値で、**中身をこちらで決められない。** だから
 * 「決められなかった」を異常として扱わず、既定に倒して描き進める。倒したことは残す
 * (静かに劣化させない)。
 */
export function resolveLocaleOrDefault(request: Request): SupportedLocale {
  try {
    return resolveLocale(request);
  } catch (error) {
    console.error("failed to resolve the locale; falling back", error);
    return defaultLocale;
  }
}
