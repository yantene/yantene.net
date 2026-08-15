import { describe, expect, it } from "vitest";
import { buildPageMeta, translationsFor } from "./page-meta";

/**
 * 全ページ共通の meta 生成。過去に「jsonLd を持たないページが全部 500」という
 * 回帰を出した経路なので、jsonLd の有無を必ず両方検証する。
 */
describe("buildPageMeta", () => {
  const origin = "https://yantene.net";
  const pathname = "/notes/foo";

  function find(
    descriptors: ReturnType<typeof buildPageMeta>,
    key: "property" | "name",
    value: string,
  ): string | undefined {
    const hit = descriptors.find((d) => {
      const record = d as Record<string, unknown>;
      return (key === "property" ? record.property : record.name) === value;
    });
    return hit === undefined
      ? undefined
      : ((hit as Record<string, unknown>).content as string);
  }

  it("omits the ld+json descriptor when jsonLd is not given", () => {
    const meta = buildPageMeta({ locale: "ja", origin, pathname });

    expect(
      meta.some((d) => "script:ld+json" in (d as Record<string, unknown>)),
    ).toBe(false);
  });

  it("emits the ld+json descriptor when jsonLd is given", () => {
    const jsonLd = { "@type": "BlogPosting", headline: "テスト記事" };
    const meta = buildPageMeta({ locale: "ja", origin, pathname, jsonLd });

    const ld = meta.find(
      (d) => "script:ld+json" in (d as Record<string, unknown>),
    );
    expect(ld).toEqual({ "script:ld+json": jsonLd });
  });

  it("falls back to the site title when no page title is given", () => {
    const meta = buildPageMeta({ locale: "ja", origin, pathname });
    const site = translationsFor("ja").meta;

    expect(meta[0]).toEqual({ title: site.title });
    expect(find(meta, "name", "description")).toBe(site.description);
  });

  it("prefixes the page title to the site title", () => {
    const meta = buildPageMeta({
      locale: "ja",
      origin,
      pathname,
      title: "記事タイトル",
    });
    const site = translationsFor("ja").meta;

    expect(meta[0]).toEqual({ title: `記事タイトル - ${site.title}` });
    expect(find(meta, "property", "og:title")).toBe(
      `記事タイトル - ${site.title}`,
    );
  });

  // トップは見出しがサイト名そのものなので、機械的に繋ぐと二重になる。
  it("does not repeat the site title when the page title is the same", () => {
    const site = translationsFor("ja").meta;
    const meta = buildPageMeta({
      locale: "ja",
      origin,
      pathname,
      title: site.title,
    });

    expect(meta[0]).toEqual({ title: site.title });
    expect(find(meta, "property", "og:title")).toBe(site.title);
  });

  it("builds an absolute OG image URL from origin and imagePath", () => {
    const meta = buildPageMeta({
      locale: "ja",
      origin,
      pathname,
      imagePath: "/og/notes/foo",
    });

    expect(find(meta, "property", "og:image")).toBe(
      "https://yantene.net/og/notes/foo",
    );
    expect(find(meta, "name", "twitter:image")).toBe(
      "https://yantene.net/og/notes/foo",
    );
  });

  it("defaults the OG image to the site-wide one", () => {
    const meta = buildPageMeta({ locale: "ja", origin, pathname });

    expect(find(meta, "property", "og:image")).toBe(
      "https://yantene.net/og/default",
    );
  });

  /*
   * コンテンツは日本語なので og:locale は locale に連動させず ja_JP で固定する。
   * クローラーは Accept-Language を送らないことが多く、そこで en_US を返すと
   * 日本語記事を英語ページとして扱わせてしまう。
   */
  it("always reports ja_JP as the OG locale", () => {
    for (const locale of ["ja", "en"]) {
      expect(
        find(
          buildPageMeta({ locale, origin, pathname }),
          "property",
          "og:locale",
        ),
      ).toBe("ja_JP");
    }
  });

  /* canonical と og:url は SEO / OGP の要。移行で一度落としたので回帰を張る。 */
  it("emits a canonical link built from origin and pathname", () => {
    const meta = buildPageMeta({ locale: "ja", origin, pathname });

    expect(meta).toContainEqual({
      tagName: "link",
      rel: "canonical",
      href: "https://yantene.net/notes/foo",
    });
  });

  it("emits og:url built from origin and pathname", () => {
    const meta = buildPageMeta({ locale: "ja", origin, pathname });

    expect(find(meta, "property", "og:url")).toBe(
      "https://yantene.net/notes/foo",
    );
  });

  /*
   * ページ固有のフィード (タグ別など) だけを出す。サイト全体のフィードは root の
   * links が全ページに出しているので、ここで二重に出すとリーダーの選択肢が濁る。
   */
  it("omits the alternate feed link when no page feed is given", () => {
    const meta = buildPageMeta({ locale: "ja", origin, pathname });

    expect(
      meta.some((d) => (d as Record<string, unknown>).rel === "alternate"),
    ).toBe(false);
  });

  it("emits an alternate feed link built from origin and feed path", () => {
    const meta = buildPageMeta({
      locale: "ja",
      origin,
      pathname,
      feed: { path: "/feed.xml?tag=Web", title: "やんてね - Web" },
    });

    expect(meta).toContainEqual({
      tagName: "link",
      rel: "alternate",
      type: "application/atom+xml",
      title: "やんてね - Web",
      href: "https://yantene.net/feed.xml?tag=Web",
    });
  });

  /*
   * Webmention の受け口はノート宛だけなので、記事ページ以外は広告しない。
   * 全ページが通る経路なので、渡されなかったときに何も足さないことを固定する
   * (jsonLd で「渡さないページが全部 500」を出した前科がある)。
   */
  it("omits the webmention link when no endpoint is given", () => {
    for (const pathname of ["/", "/notes", "/notes?tag=Web", "/notes/foo"]) {
      const meta = buildPageMeta({ locale: "ja", origin, pathname });

      expect(
        meta.some((d) => (d as Record<string, unknown>).rel === "webmention"),
      ).toBe(false);
    }
  });

  it("emits the webmention link when an endpoint is given", () => {
    const meta = buildPageMeta({
      locale: "ja",
      origin,
      pathname,
      webmentionPath: "/webmention",
    });

    expect(meta).toContainEqual({
      tagName: "link",
      rel: "webmention",
      href: "https://yantene.net/webmention",
    });
  });

  it("marks article pages with og:type article", () => {
    expect(
      find(
        buildPageMeta({ locale: "ja", origin, pathname, type: "article" }),
        "property",
        "og:type",
      ),
    ).toBe("article");
    expect(
      find(
        buildPageMeta({ locale: "ja", origin, pathname }),
        "property",
        "og:type",
      ),
    ).toBe("website");
  });
});

describe("translationsFor", () => {
  it("returns the requested locale's translations", () => {
    expect(translationsFor("ja")).toBe(translationsFor("ja"));
    expect(translationsFor("ja").meta.title).toBeTruthy();
  });

  it("falls back to English for unsupported locales", () => {
    expect(translationsFor("xx")).toEqual(translationsFor("en"));
  });
});
