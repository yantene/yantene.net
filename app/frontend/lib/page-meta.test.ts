import { describe, expect, it } from "vitest";
import { buildPageMeta, translationsFor } from "./page-meta";

/**
 * 全ページ共通の meta 生成。過去に「jsonLd を持たないページが全部 500」という
 * 回帰を出した経路なので、jsonLd の有無を必ず両方検証する。
 */
describe("buildPageMeta", () => {
  const origin = "https://yantene.net";

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
    const meta = buildPageMeta({ locale: "ja", origin });

    expect(
      meta.some((d) => "script:ld+json" in (d as Record<string, unknown>)),
    ).toBe(false);
  });

  it("emits the ld+json descriptor when jsonLd is given", () => {
    const jsonLd = { "@type": "BlogPosting", headline: "テスト記事" };
    const meta = buildPageMeta({ locale: "ja", origin, jsonLd });

    const ld = meta.find(
      (d) => "script:ld+json" in (d as Record<string, unknown>),
    );
    expect(ld).toEqual({ "script:ld+json": jsonLd });
  });

  it("falls back to the site title when no page title is given", () => {
    const meta = buildPageMeta({ locale: "ja", origin });
    const site = translationsFor("ja").meta;

    expect(meta[0]).toEqual({ title: site.title });
    expect(find(meta, "name", "description")).toBe(site.description);
  });

  it("prefixes the page title to the site title", () => {
    const meta = buildPageMeta({ locale: "ja", origin, title: "記事タイトル" });
    const site = translationsFor("ja").meta;

    expect(meta[0]).toEqual({ title: `記事タイトル | ${site.title}` });
    expect(find(meta, "property", "og:title")).toBe(
      `記事タイトル | ${site.title}`,
    );
  });

  it("builds an absolute OG image URL from origin and imagePath", () => {
    const meta = buildPageMeta({
      locale: "ja",
      origin,
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
    const meta = buildPageMeta({ locale: "ja", origin });

    expect(find(meta, "property", "og:image")).toBe(
      "https://yantene.net/og/default",
    );
  });

  it("maps the locale to an OG locale tag", () => {
    expect(
      find(buildPageMeta({ locale: "ja", origin }), "property", "og:locale"),
    ).toBe("ja_JP");
    expect(
      find(buildPageMeta({ locale: "en", origin }), "property", "og:locale"),
    ).toBe("en_US");
  });

  it("marks article pages with og:type article", () => {
    expect(
      find(
        buildPageMeta({ locale: "ja", origin, type: "article" }),
        "property",
        "og:type",
      ),
    ).toBe("article");
    expect(
      find(buildPageMeta({ locale: "ja", origin }), "property", "og:type"),
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
