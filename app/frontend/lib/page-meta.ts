import type { MetaDescriptor } from "react-router";
import type { SupportedLocale } from "~/lib/i18n/locale";
import { isSupportedLocale } from "~/lib/i18n/locale";
import resources from "~/lib/i18n/locales";

/**
 * すべてのページの loader が返す共通フィールド。meta 関数は React の外で動くため、
 * 翻訳と絶対 URL の組み立てに必要な情報を loader から受け取る。
 */
export interface PageMetaBase {
  readonly locale: SupportedLocale;
  readonly origin: string;
}

/**
 * meta 関数は React コンポーネントの外で動くため useTranslation を使えない。
 * locale から翻訳リソースを直接引く。
 */
export function translationsFor(
  locale: string,
): (typeof resources)["en"]["translation"] {
  return (
    isSupportedLocale(locale)
      ? // eslint-disable-next-line security/detect-object-injection -- locale is narrowed to SupportedLocale literal
        resources[locale]
      : resources.en
  ).translation;
}

export interface PageMetaInput {
  readonly locale: string;
  readonly origin: string;
  /** ページ固有のタイトル。省略時はサイト既定のタイトルのみを使う。 */
  readonly title?: string;
  readonly description?: string;
  /** OG 画像のパス (例: "/og/notes/foo")。origin を前置して絶対 URL にする。 */
  readonly imagePath?: string;
  readonly type?: "website" | "article";
  /** schema.org 構造化データ。渡された場合のみ ld+json を出力する。 */
  readonly jsonLd?: Record<string, unknown>;
}

/**
 * ページの meta 一式 (title / description / OGP / Twitter Card / JSON-LD) を組み立てる。
 *
 * React Router の meta は「最も深いルートのものだけ」が採用され親とマージされないため、
 * 各ページはここを通して常に一式を出す。
 */
export function buildPageMeta({
  locale,
  origin,
  title,
  description,
  imagePath = "/og/default",
  type = "website",
  jsonLd,
}: PageMetaInput): MetaDescriptor[] {
  const site = translationsFor(locale).meta;
  const resolvedTitle =
    title === undefined || title.length === 0
      ? site.title
      : `${title} | ${site.title}`;
  const resolvedDescription =
    description === undefined || description.length === 0
      ? site.description
      : description;
  const image = `${origin}${imagePath}`;

  const descriptors: MetaDescriptor[] = [
    { title: resolvedTitle },
    { name: "description", content: resolvedDescription },
    { property: "og:site_name", content: "yantene.net" },
    { property: "og:locale", content: locale === "ja" ? "ja_JP" : "en_US" },
    { property: "og:title", content: resolvedTitle },
    { property: "og:description", content: resolvedDescription },
    { property: "og:image", content: image },
    { property: "og:type", content: type },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: resolvedTitle },
    { name: "twitter:description", content: resolvedDescription },
    { name: "twitter:image", content: image },
  ];

  if (jsonLd !== undefined) {
    descriptors.push({ "script:ld+json": jsonLd });
  }

  return descriptors;
}
