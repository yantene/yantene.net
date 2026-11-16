import { describe, expect, it } from "vitest";
import { meta as articlesMeta } from "./articles";
import { meta as homeMeta } from "./home";
import { meta as worksMeta } from "./works";
import { collectionPageJsonLd, homeJsonLd } from "~/backend/handlers/profile/person-json-ld";

/*
 * loader が組んだ JSON-LD を、ルートの `meta` が HTML まで運ぶこと (ADR 0048)。
 *
 * 中身を組むのは loader の側で、そちらは形をテストで固定してある。ここが見るのは**配線**。
 * React Router の meta は最も深いルートのものだけが採用されるので、ルートの `meta` が
 * `jsonLd` を `buildPageMeta` に渡し忘れると、loader がどれだけ正しく組んでいても HTML には
 * 1 文字も出ない。画面には何も出ないので、気づく手立てがここにしか無い。
 */
const ORIGIN = "https://yantene.net";

type AnyMeta = (args: never) => readonly object[] | undefined;

function ldJsonOf(meta: AnyMeta, pathname: string, loaderData: object): readonly object[] {
  const descriptors = meta({ loaderData, location: { pathname } } as never) ?? [];
  return descriptors.filter((descriptor) => "script:ld+json" in descriptor);
}

const BASE = { locale: "ja", origin: ORIGIN };

describe("ルートの meta は loader の JSON-LD をそのまま出す", () => {
  it("トップ", () => {
    const jsonLd = homeJsonLd(ORIGIN, null);

    expect(ldJsonOf(homeMeta, "/", { ...BASE, jsonLd })).toEqual([{ "script:ld+json": jsonLd }]);
  });

  it("/articles", () => {
    const jsonLd = collectionPageJsonLd(ORIGIN, "/articles");

    expect(ldJsonOf(articlesMeta, "/articles", { ...BASE, jsonLd })).toEqual([
      { "script:ld+json": jsonLd },
    ]);
  });

  it("/works", () => {
    const jsonLd = collectionPageJsonLd(ORIGIN, "/works");
    const works = [{ slug: "infoholick", name: "infoholick", summary: "概要。", url: null }];

    expect(ldJsonOf(worksMeta, "/works", { ...BASE, works, jsonLd })).toEqual([
      { "script:ld+json": jsonLd },
    ]);
  });

  /* 作品が無いあいだの `/works` は「準備中」+ noindex。loader が null を返し、何も出さない。 */
  it("/works は作品が無ければ何も出さない", () => {
    expect(ldJsonOf(worksMeta, "/works", { ...BASE, works: [], jsonLd: null })).toEqual([]);
  });
});
