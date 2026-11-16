import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import { loadArticlesListPage, loadHomePage } from "./pages.handler";
import type { ArticlesListPageData } from "./pages.handler";
import type { IUnpersisted } from "~/backend/domain/shared";
import { Article, ArticleSlug, ArticleTitle } from "~/backend/domain/article";
import {
  HistoryDate,
  HistoryEntry,
  Profile,
  ProfileName,
  SocialAccount,
  Tagline,
} from "~/backend/domain/profile";
import {
  D1ArticleCommandRepository,
  D1ArticleSearchIndex,
  D1ProfileCommandRepository,
} from "~/backend/infra/d1/repositories";
import { createTestD1 } from "~/backend/infra/d1/test-helper";
import { FALLBACK_PROFILE_NAME, PROFILE_PHOTO } from "~/lib/profile-fallback";

function article(slug: string, publishedOn: string): Article<IUnpersisted> {
  return Article.create({
    slug: ArticleSlug.create(slug),
    title: ArticleTitle.create(slug),
    summary: `summary of ${slug}`,
    publishedOn: Temporal.PlainDate.from(publishedOn),
    lastModifiedOn: Temporal.PlainDate.from(publishedOn),
    status: "published",
    sourceHash: `hash-${slug}`,
  });
}

async function seed(d1: D1Database): Promise<void> {
  const cmd = new D1ArticleCommandRepository(d1);
  const index = new D1ArticleSearchIndex(d1);
  for (const [slug, publishedOn] of [
    ["alpha", "2026-01-10"],
    ["bravo", "2025-03-10"],
    ["charlie", "2024-02-10"],
  ] as const) {
    await cmd.upsert(article(slug, publishedOn));
    // 検索は索引を引く。本文を持たないので、表題と要約だけ入れておく。
    await index.index({
      slug: ArticleSlug.create(slug),
      title: slug,
      body: `summary of ${slug}`,
    });
  }
}

const envWith = (d1: D1Database): Env => ({ D1: d1 }) as unknown as Env;

const load = (d1: D1Database, search: string): Promise<ArticlesListPageData> =>
  loadArticlesListPage(envWith(d1), new URL(`https://example.com/articles${search}`));

/*
 * トップはサイト (`WebSite`) と書き手 (`Person`) を名乗る (ADR 0048)。
 *
 * 全ページ共通の出し口を通るので、プロフィールの有無の両方で形を固定する。
 */
describe("loadHomePage の JSON-LD (ADR 0048)", () => {
  const ORIGIN = "https://example.com";
  const PERSON_ID = `${ORIGIN}/#person`;

  const graphOf = (jsonLd: Record<string, unknown>): readonly Record<string, unknown>[] =>
    jsonLd["@graph"] as readonly Record<string, unknown>[];

  it("プロフィールが無くてもサイト名と書き手の殻を出す", async () => {
    const { jsonLd } = await loadHomePage(envWith(createTestD1()), ORIGIN);

    expect(jsonLd).toEqual({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebSite",
          "@id": `${ORIGIN}/#website`,
          name: "やんてね",
          alternateName: "yantene.net",
          url: `${ORIGIN}/`,
          publisher: { "@id": PERSON_ID },
        },
        {
          "@type": "Person",
          "@id": PERSON_ID,
          name: FALLBACK_PROFILE_NAME,
          url: `${ORIGIN}/about`,
          image: `${ORIGIN}${PROFILE_PHOTO}`,
        },
      ],
    });
  });

  it("プロフィールがあれば、書き手の名前と出ていく先が入る", async () => {
    const d1 = createTestD1();
    await new D1ProfileCommandRepository(d1).upsert(
      Profile.create({
        name: ProfileName.create("書き手"),
        tagline: Tagline.create("自己紹介。"),
        socials: [
          SocialAccount.create({
            platform: "github",
            url: "https://github.com/yantene",
            isMe: true,
          }),
          SocialAccount.create({ platform: "x", url: "https://x.com/yantene", isMe: false }),
        ],
        sourceHash: "h1",
      }),
      [HistoryEntry.create({ chapter: "高校", date: HistoryDate.create("2012-03"), text: "卒業" })],
    );

    const { jsonLd } = await loadHomePage(envWith(d1), ORIGIN);
    const [site, person] = graphOf(jsonLd);

    expect(site?.publisher).toEqual({ "@id": PERSON_ID });
    expect(person).toEqual({
      "@type": "Person",
      "@id": PERSON_ID,
      name: "書き手",
      url: `${ORIGIN}/about`,
      image: `${ORIGIN}${PROFILE_PHOTO}`,
      description: "自己紹介。",
      sameAs: ["https://github.com/yantene"],
    });
    // ⚠️ 経歴は機械に名乗らない (ADR 0044)。新しく Person を出す場所なので、ここでも見張る。
    expect(JSON.stringify(jsonLd)).not.toContain("卒業");
  });
});

describe("loadArticlesListPage", () => {
  /*
   * 一覧は `CollectionPage` として名乗り、サイトの一部だと言う (ADR 0048)。検索の結果でも
   * ページ送りの途中でも、名乗る URL は canonical と同じ `/articles`。
   */
  it("どの絞り込みでも、同じ一覧としてサイトの一部だと名乗る", async () => {
    const d1 = createTestD1();
    await seed(d1);
    const expected = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      url: "https://example.com/articles",
      isPartOf: { "@id": "https://example.com/#website" },
    };

    expect((await load(d1, "")).jsonLd).toEqual(expected);
    expect((await load(d1, "?q=alpha&page=2")).jsonLd).toEqual(expected);
  });

  it("絞り込みがなければ公開日の新しい順に全件返す", async () => {
    const d1 = createTestD1();
    await seed(d1);

    const page = await load(d1, "");
    expect(page.articles.map((n) => n.slug)).toEqual(["alpha", "bravo", "charlie"]);
    expect(page.query).toBe("");
  });

  /* タグは廃止した (ADR 0029)。残っている ?tag= は無視して全件返す。 */
  it("?tag= は無視して全件返す", async () => {
    const d1 = createTestD1();
    await seed(d1);

    const page = await load(d1, "?tag=Web");
    expect(page.articles.map((n) => n.slug)).toEqual(["alpha", "bravo", "charlie"]);
  });

  it("検索語を受け取り、結果を 1 ページに収める", async () => {
    const d1 = createTestD1();
    await seed(d1);

    const page = await load(d1, "?q=alpha");
    expect(page.query).toBe("alpha");
    expect(page.articles.map((n) => n.slug)).toEqual(["alpha"]);
    /*
     * 検索は上限までを一度に返すので続きが無い。ページを分けてしまうと、続きを取る
     * API に検索語が渡らず無関係な記事が混ざる。
     */
    expect(page.pagination.totalPages).toBe(1);
  });

  it("空白だけの検索語は指定なしとして扱う", async () => {
    const d1 = createTestD1();
    await seed(d1);

    const page = await load(d1, "?q=%20%20");
    expect(page.query).toBe("");
    expect(page.articles).toHaveLength(3);
  });

  it("一致しない検索語では空になる", async () => {
    const d1 = createTestD1();
    await seed(d1);

    const page = await load(d1, "?q=zzzznotfound");
    expect(page.articles).toHaveLength(0);
    expect(page.pagination.total).toBe(0);
  });
});
