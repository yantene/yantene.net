import { RouterContextProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { meta as aboutMeta } from "./about";
import { meta as articlesMeta } from "./articles";
import { meta as articleMeta } from "./articles.$slug";
import { meta as homeMeta } from "./home";
import * as legal from "./legal";
import * as notes from "./notes";
import * as signIn from "./sign-in";
import * as signInConfirm from "./sign-in.confirm";
import * as signInSent from "./sign-in.sent";
import * as slides from "./slides";
import { meta as worksMeta } from "./works";
import { meta as workMeta } from "./works.$slug";
import {
  collectionPageJsonLd,
  homeJsonLd,
  profilePageJsonLd,
  webPageJsonLd,
} from "~/backend/handlers/json-ld";
import { cloudflareContext } from "~/frontend/lib/route-context";
import routes from "~/frontend/routes";

/*
 * どのページも構造化データを HTML まで運ぶこと (ADR 0048)。
 *
 * 中身を組むのは `backend/handlers/json-ld` で、形はそちらのテストが固定している。組むのを
 * 呼ぶのは loader で、`meta` は運ぶだけ (`meta` はブラウザでも走るので、そこで組むと組み
 * 立ての側がクライアントのバンドルに入る)。ここが見るのは**配線**。React Router の meta は最も深いルートのものだけが採用されるので、
 * ルートの `meta` が `jsonLd` を `buildPageMeta` に渡し忘れると、どれだけ正しく組んで
 * いても HTML には 1 文字も出ない。画面には何も出ないので、気づく手立てがここにしか無い。
 */
const ORIGIN = "https://yantene.net";
const BASE = { locale: "ja", origin: ORIGIN };

type AnyMeta = (args: never) => readonly object[] | undefined;

function ldJsonOf(meta: AnyMeta, pathname: string, loaderData: object): readonly object[] {
  const descriptors = meta({ loaderData, location: { pathname } } as never) ?? [];
  return descriptors.flatMap((descriptor) =>
    "script:ld+json" in descriptor ? [descriptor["script:ld+json"] as object] : [],
  );
}

/** loader が組んで渡す型のページ。渡されたものがそのまま出ること。 */
const PASSED_THROUGH = {
  "routes/home.tsx": () => {
    const jsonLd = homeJsonLd(ORIGIN, null);
    return { actual: ldJsonOf(homeMeta, "/", { ...BASE, jsonLd }), expected: jsonLd };
  },
  "routes/about.tsx": () => {
    const jsonLd = profilePageJsonLd(ORIGIN, null);
    return {
      actual: ldJsonOf(aboutMeta, "/about", { ...BASE, profile: null, jsonLd }),
      expected: jsonLd,
    };
  },
  "routes/articles.tsx": () => {
    const jsonLd = collectionPageJsonLd(ORIGIN, "/articles");
    return { actual: ldJsonOf(articlesMeta, "/articles", { ...BASE, jsonLd }), expected: jsonLd };
  },
  "routes/articles.$slug.tsx": () => {
    const jsonLd = { "@type": "BlogPosting" };
    const article = { slug: "hello", title: "Hello", summary: "概要。" };
    return {
      actual: ldJsonOf(articleMeta, "/articles/hello", {
        ...BASE,
        found: true,
        article,
        jsonLd,
        noindex: false,
      }),
      expected: jsonLd,
    };
  },
  "routes/works.tsx": () => {
    const jsonLd = collectionPageJsonLd(ORIGIN, "/works");
    return {
      actual: ldJsonOf(worksMeta, "/works", { ...BASE, works: [], jsonLd }),
      expected: jsonLd,
    };
  },
  "routes/works.$slug.tsx": () => {
    const jsonLd = { "@type": "CreativeWork" };
    const work = { slug: "infoholick", name: "infoholick", summary: "概要。", url: null };
    return {
      actual: ldJsonOf(workMeta, "/works/infoholick", { ...BASE, work, jsonLd }),
      expected: jsonLd,
    };
  },
} as const;

/**
 * 中身がその場所の URL だけで決まるページ。loader が自分で組むので、ここでは loader を
 * 実際に走らせて、組んだものが `meta` を通って出てくるところまでを通しで見る。
 */
const BUILT_IN_THE_LOADER = {
  "routes/notes.tsx": { route: notes, path: "/notes", build: collectionPageJsonLd },
  "routes/slides.tsx": { route: slides, path: "/slides", build: collectionPageJsonLd },
  "routes/legal.tsx": { route: legal, path: "/legal", build: webPageJsonLd },
  "routes/sign-in.tsx": { route: signIn, path: "/sign-in", build: webPageJsonLd },
  "routes/sign-in.sent.tsx": { route: signInSent, path: "/sign-in/sent", build: webPageJsonLd },
  "routes/sign-in.confirm.tsx": {
    route: signInConfirm,
    path: "/sign-in/confirm",
    build: webPageJsonLd,
  },
} as const;

type AnyLoader = (args: never) => unknown;

/** loader を、cookie の無い読み手の要求で走らせる。`data()` で包まれていれば中身を取り出す。 */
async function loaderDataOf(loader: AnyLoader, path: string): Promise<object> {
  const context = new RouterContextProvider();
  context.set(cloudflareContext, {
    env: { APP_ENV: "test" } as unknown as Env,
    ctx: {} as unknown as ExecutionContext,
  });
  // クエリを付けておく。構造化データの `url` に、絞り込みやトークンを載せないこと。
  const request = new Request(`${ORIGIN}${path}?token=secret&page=2`);
  const result = (await loader({ request, context, params: {} } as never)) as object;

  return "data" in result && typeof result.data === "object" && result.data !== null
    ? result.data
    : result;
}

describe("ルートの meta は構造化データを HTML まで運ぶ", () => {
  it.each(Object.entries(PASSED_THROUGH))("%s: loader が組んだものをそのまま出す", (_, run) => {
    const { actual, expected } = run();

    expect(actual).toEqual([expected]);
  });

  it.each(Object.entries(BUILT_IN_THE_LOADER))(
    "%s: loader がその場所の URL で組み、meta がそのまま出す",
    async (_, page) => {
      const loaderData = await loaderDataOf(page.route.loader, page.path);

      expect(ldJsonOf(page.route.meta, page.path, loaderData)).toEqual([
        page.build(ORIGIN, page.path),
      ]);
    },
  );

  /*
   * **ルートを足したら、ここにも足す。** 足し忘れると、そのページだけ構造化データが無い
   * まま出る。それは画面からは見えない。
   */
  it("どのルートも、上のどちらかで確かめてある", () => {
    const covered = [...Object.keys(PASSED_THROUGH), ...Object.keys(BUILT_IN_THE_LOADER)];

    expect(routes.map((entry) => entry.file).toSorted()).toEqual(covered.toSorted());
  });
});

/*
 * 存在しないページは名乗らない。404 を返しているページが「自分はこのサイトの記事だ」と
 * 言うのは嘘になる。
 */
describe("見つからなかったページは構造化データを出さない", () => {
  it("記事", () => {
    expect(ldJsonOf(articleMeta, "/articles/nope", { ...BASE, found: false })).toEqual([]);
  });

  it("作品", () => {
    expect(ldJsonOf(workMeta, "/works/nope", { ...BASE, work: null, jsonLd: null })).toEqual([]);
  });
});
