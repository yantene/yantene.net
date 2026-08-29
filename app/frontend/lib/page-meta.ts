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
export function translationsFor(locale: string): (typeof resources)["en"]["translation"] {
  return (
    isSupportedLocale(locale)
      ? // locale is narrowed to SupportedLocale literal
        resources[locale]
      : resources.en
  ).translation;
}

export interface PageMetaInput {
  readonly locale: string;
  readonly origin: string;
  /**
   * 正規 URL のパス (`location.pathname`)。origin と結合して canonical / og:url にする。
   * 旧実装に合わせクエリは含めない。
   */
  readonly pathname: string;
  /** ページ固有のタイトル。省略時はサイト既定のタイトルのみを使う。 */
  readonly title?: string;
  readonly description?: string;
  /** OG 画像のパス (例: "/og/notes/foo")。origin を前置して絶対 URL にする。 */
  readonly imagePath?: string;
  readonly type?: "website" | "article";
  /** schema.org 構造化データ。渡された場合のみ ld+json を出力する。 */
  readonly jsonLd?: Record<string, unknown>;
  /**
   * そのページに対応する Atom フィード。渡された場合のみ rel=alternate を足す。
   *
   * サイト全体のフィードは root の links が全ページに出しているので、ここで渡すのは
   * 「このページを見ているならこちらの方が近い」フィード (タグで絞った一覧など) だけ。
   * リーダーは title で区別するため、全体フィードと同じ名前にしないこと。
   */
  readonly feed?: { readonly path: string; readonly title: string };
  /**
   * Webmention の受け口 (`WEBMENTION_PATH`)。渡されたページだけが広告する。
   *
   * 受け取れるのはノート宛だけなので、一覧やトップで広告しても送り手を無駄に
   * 400 へ歩かせるだけになる。
   */
  readonly webmentionPath?: string;
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
  pathname,
  title,
  description,
  imagePath = "/og/default",
  type = "website",
  jsonLd,
  feed,
  webmentionPath,
}: PageMetaInput): MetaDescriptor[] {
  const site = translationsFor(locale).meta;
  /*
   * ページ名がサイト名と同じときは重ねない。トップは見出しがサイト名そのものなので、
   * 機械的に繋ぐと「やんてね - やんてね」になってしまう。
   */
  const resolvedTitle =
    title === undefined || title.length === 0 || title === site.title
      ? site.title
      : `${title} - ${site.title}`;
  const resolvedDescription =
    description === undefined || description.length === 0 ? site.description : description;
  const image = `${origin}${imagePath}`;
  const url = `${origin}${pathname}`;

  const descriptors: MetaDescriptor[] = [
    { title: resolvedTitle },
    { name: "description", content: resolvedDescription },
    { tagName: "link", rel: "canonical", href: url },
    // サイト名は locale に追従させる (英語では仮名が読めないため)。
    { property: "og:site_name", content: site.title },
    /*
     * コンテンツは日本語なので ja_JP で固定する (locale に連動させない)。
     * UI 文言のロケールは Accept-Language 次第で en になるが、クローラーは
     * Accept-Language を送らないことが多く、そこで en_US を返すと日本語記事を
     * 英語ページとして扱わせてしまう。
     */
    { property: "og:locale", content: "ja_JP" },
    { property: "og:title", content: resolvedTitle },
    { property: "og:description", content: resolvedDescription },
    { property: "og:image", content: image },
    { property: "og:url", content: url },
    { property: "og:type", content: type },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: resolvedTitle },
    { name: "twitter:description", content: resolvedDescription },
    { name: "twitter:image", content: image },
  ];

  if (feed !== undefined) {
    descriptors.push({
      tagName: "link",
      rel: "alternate",
      type: "application/atom+xml",
      title: feed.title,
      href: `${origin}${feed.path}`,
    });
  }

  if (webmentionPath !== undefined) {
    descriptors.push({
      tagName: "link",
      rel: "webmention",
      href: `${origin}${webmentionPath}`,
    });
  }

  if (jsonLd !== undefined) {
    descriptors.push({ "script:ld+json": jsonLd });
  }

  return descriptors;
}
