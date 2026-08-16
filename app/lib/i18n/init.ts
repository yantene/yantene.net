import i18next, { type i18n } from "i18next";
import { initReactI18next } from "react-i18next";
import { defaultLocale } from "~/lib/i18n/locale";
import resources from "~/lib/i18n/locales";

const baseOptions = {
  fallbackLng: defaultLocale,
  resources,
  interpolation: { escapeValue: false },
};

export async function initI18nGlobal(locale: string): Promise<typeof i18next> {
  await i18next.use(initReactI18next).init({ ...baseOptions, lng: locale });
  return i18next;
}

export async function createI18nInstance(locale: string): Promise<i18n> {
  const instance = i18next.createInstance();
  await instance.use(initReactI18next).init({ ...baseOptions, lng: locale });
  return instance;
}
