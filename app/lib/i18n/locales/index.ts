import en from "./en.json";
import ja from "./ja.json";
import type { Resource } from "i18next";

const resources = {
  en: { translation: en },
  ja: { translation: ja },
} satisfies Resource;

export default resources;
