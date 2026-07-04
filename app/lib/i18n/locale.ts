export type SupportedLocale = "en" | "ja";
export const supportedLocales: readonly SupportedLocale[] = ["en", "ja"];

export const localeLabels: Record<SupportedLocale, string> = {
  en: "English",
  ja: "日本語",
};

export const localeCookieName = "locale";
export const localeCookieMaxAgeSeconds = 60 * 60 * 24 * 365;

export function isSupportedLocale(value: string): value is SupportedLocale {
  return (supportedLocales as readonly string[]).includes(value);
}
