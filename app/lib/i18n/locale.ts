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

/**
 * 切り替えの操作子に出す短い名前。
 *
 * 見えるのはこちらだが、読み上げに渡すのは {@link localeLabels} のほう。2 文字の略号は
 * 音にすると「イーエヌ」で、何のことか分からない。
 */
export const localeAbbreviations: Record<SupportedLocale, string> = {
  en: "EN",
  ja: "JA",
};

export const localeCookieName = "locale";
export const localeCookieMaxAgeSeconds = 60 * 60 * 24 * 365;

/**
 * ロケールを選ぶフォームの送り先と、その欄の名前。
 *
 * **受け口 (backend/handlers/locale.handler.ts) と描画 (frontend の切り替え) の両方が
 * 読む。** 受け口の側に置くと、描画側がそれを読むために Hono ごとクライアントの束に
 * 引きずり込むことになる。どちらにも属さない値なので、両方から見えるここに置く。
 */
export const localePath = "/locale";
export const localeField = "locale";
export const localeReturnToField = "return-to";

export function isSupportedLocale(value: string): value is SupportedLocale {
  return (supportedLocales as readonly string[]).includes(value);
}
