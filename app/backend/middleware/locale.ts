import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import {
  type SupportedLocale,
  isSupportedLocale,
  localeCookieName,
} from "~/lib/i18n/locale";

export type LocaleVariables = {
  locale: SupportedLocale;
};

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

export const localeMiddleware = createMiddleware<{
  Variables: LocaleVariables;
}>(async (c, next) => {
  const fromCookie = getCookie(c, localeCookieName) ?? "";
  if (isSupportedLocale(fromCookie)) {
    c.set("locale", fromCookie);
    await next();
    return;
  }

  const fromHeader = parseAcceptLanguage(c.req.header("Accept-Language") ?? "");
  c.set("locale", fromHeader ?? "en");
  await next();
});
