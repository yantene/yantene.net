import { describe, expect, it } from "vitest";
import { meta } from "./home";
import { homeJsonLd } from "~/backend/handlers/profile/person-json-ld";

/*
 * トップは `WebSite` と書き手の `Person` を JSON-LD で名乗る (ADR 0048)。
 *
 * 中身を組むのは loader の側 (`loadHomePage`) で、そちらは形をテストで固定してある。
 * ここが見るのは**配線**。React Router の meta は最も深いルートのものだけが採用されるので、
 * このルートの `meta` が `jsonLd` を `buildPageMeta` に渡し忘れると、loader がどれだけ
 * 正しく組んでいても HTML には 1 文字も出ない。画面には何も出ないので、気づく手立てが
 * ここにしか無い。
 */
const ORIGIN = "https://yantene.net";

type MetaArgs = Parameters<typeof meta>[0];

function metaFor(loaderData: Record<string, unknown>): ReturnType<typeof meta> {
  return meta({ loaderData, location: { pathname: "/" } } as unknown as MetaArgs);
}

describe("home の meta", () => {
  it("loader が組んだ JSON-LD を、そのまま ld+json として出す", () => {
    const jsonLd = homeJsonLd(ORIGIN, null);

    const descriptors = metaFor({ locale: "ja", origin: ORIGIN, jsonLd }) ?? [];
    const scripts = descriptors.filter((descriptor) => "script:ld+json" in descriptor);

    expect(scripts).toEqual([{ "script:ld+json": jsonLd }]);
  });
});
