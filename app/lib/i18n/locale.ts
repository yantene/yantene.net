export type SupportedLocale = "en" | "ja";
export const supportedLocales: readonly SupportedLocale[] = ["en", "ja"];

/**
 * 何も手掛かりが無いときのロケール。
 *
 * 決める側 (resolve-locale.ts / prepare-i18n.ts)、i18next の fallbackLng (init.ts)、
 * hydrate するときの読み取り先が空だったとき (entry.client.tsx)、loader の値がまだ
 * 無いとき (root.tsx) が、同じ答えに落ちるようにする。
 *
 * page-meta.ts の `resources["en"]` だけは型の位置で使うため直書きのまま。
 */
export const defaultLocale: SupportedLocale = "en";

export const localeLabels: Record<SupportedLocale, string> = {
  en: "English",
  ja: "日本語",
};

export const localeCookieName = "locale";
export const localeCookieMaxAgeSeconds = 60 * 60 * 24 * 365;

export function isSupportedLocale(value: string): value is SupportedLocale {
  return (supportedLocales as readonly string[]).includes(value);
}
