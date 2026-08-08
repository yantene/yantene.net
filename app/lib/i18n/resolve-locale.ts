import {
  isSupportedLocale,
  localeCookieName,
  type SupportedLocale,
} from "~/lib/i18n/locale";

/**
 * Cookie ヘッダーから locale クッキーの値を取り出す。
 * 値の妥当性 (SupportedLocale か) の判定は呼び出し側で行う。
 */
function readLocaleCookie(cookieHeader: string): string | undefined {
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.split("=");
    if (name.trim() === localeCookieName) {
      return decodeURIComponent(rest.join("=").trim());
    }
  }
  return undefined;
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
 * 無ければ Accept-Language、どちらも無ければ "en" にフォールバックする。
 */
export function resolveLocale(request: Request): SupportedLocale {
  const fromCookie = readLocaleCookie(request.headers.get("Cookie") ?? "");
  if (fromCookie !== undefined && isSupportedLocale(fromCookie)) {
    return fromCookie;
  }

  return (
    parseAcceptLanguage(request.headers.get("Accept-Language") ?? "") ?? "en"
  );
}
