import { describe, expect, it } from "vitest";
import type { PublicProfile } from "./profile-view";
import {
  homeJsonLd,
  personId,
  personNode,
  personReference,
  profilePageJsonLd,
} from "./person-json-ld";
import { FALLBACK_PROFILE_NAME, PROFILE_PHOTO } from "~/lib/profile-fallback";

const ORIGIN = "https://yantene.net";

const PROFILE: PublicProfile = {
  name: "やんてね",
  tagline: ["東京で Web 開発者を", "やっています。"],
  socials: [
    { platform: "github", url: "https://github.com/yantene", isMe: true },
    { platform: "x", url: "https://x.com/yantene", isMe: false },
    { platform: "email", url: "mailto:contact@example.com", isMe: true },
  ],
};

/**
 * 経歴を機械に名乗らない線引き (ADR 0044 / #508)。**Person を出す場所が増えるたびに、
 * ここを通す。** 欄の許可リストは節ごとに別に固定してあるが、こちらは「入れ子のどこにも
 * 無い」ことを綴りで見る。
 */
const FORBIDDEN_KEYS = ["alumniOf", "award", "birthDate", "birthPlace", "worksFor"] as const;

function historyKeysIn(jsonLd: unknown): readonly string[] {
  const serialized = JSON.stringify(jsonLd);
  return FORBIDDEN_KEYS.filter((key) => serialized.includes(`"${key}"`));
}

describe("personId", () => {
  /*
   * 識別子なので、一度配ったら動かさない。綴りを 1 字変えると、読む側からは別人が
   * 現れたことになる。
   */
  it("is the site root with a #person fragment", () => {
    expect(personId(ORIGIN)).toBe("https://yantene.net/#person");
  });

  /* origin は要求から来る。staging で production の `@id` を名乗らない。 */
  it("follows the origin it is given", () => {
    expect(personId("https://staging.yantene.net")).toBe("https://staging.yantene.net/#person");
  });
});

describe("personNode", () => {
  it("describes the author in full when the profile is synced", () => {
    expect(personNode(ORIGIN, PROFILE)).toEqual({
      "@type": "Person",
      "@id": `${ORIGIN}/#person`,
      name: "やんてね",
      url: `${ORIGIN}/about`,
      image: `${ORIGIN}${PROFILE_PHOTO}`,
      description: "東京で Web 開発者を やっています。",
      // 相互リンクのある先だけ。メールは sameAs ではなく email へ回す。
      sameAs: ["https://github.com/yantene"],
      email: "contact@example.com",
    });
  });

  /*
   * 同期の前は殻だけ。**既定値で埋めない** — 空の `sameAs` は「出ていく先は無い」と
   * 名乗ることになる。
   */
  it("keeps only the shell before the first sync", () => {
    expect(personNode(ORIGIN, null)).toEqual({
      "@type": "Person",
      "@id": `${ORIGIN}/#person`,
      name: FALLBACK_PROFILE_NAME,
      url: `${ORIGIN}/about`,
      image: `${ORIGIN}${PROFILE_PHOTO}`,
    });
  });

  /*
   * 同期されていても、並べる先が無ければ欄ごと出さない。空の `sameAs` は「出ていく先は
   * 無い」と名乗ることになる。
   */
  it("omits sameAs and email when the profile has nowhere to point", () => {
    const node = personNode(ORIGIN, { ...PROFILE, socials: [] });

    expect(node).not.toHaveProperty("email");
    expect(node).not.toHaveProperty("sameAs");
  });

  /* 相互リンクの無い先しか無いときも同じ。主張できる先が 0 件なら出さない。 */
  it("omits sameAs when no account is verified as the author's own", () => {
    const node = personNode(ORIGIN, {
      ...PROFILE,
      socials: [{ platform: "x", url: "https://x.com/yantene", isMe: false }],
    });

    expect(node).not.toHaveProperty("sameAs");
  });

  /* 本体は参照に欄を足したもの。同じ `@id` の節が、場所によって違う名前や URL を言わない。 */
  it("agrees with the reference on every field the reference carries", () => {
    expect(personNode(ORIGIN, PROFILE)).toMatchObject(personReference(ORIGIN, PROFILE));
    expect(personNode(ORIGIN, null)).toMatchObject(personReference(ORIGIN, null));
  });
});

describe("personReference", () => {
  /*
   * `@id` だけの裸の参照にしない。Google の Article の構造化データが author に name を
   * 求めるため。**詳しいことは載せない** (本体の役)。
   */
  it("carries the id, the name and the about url, and nothing else", () => {
    expect(personReference(ORIGIN, PROFILE)).toEqual({
      "@type": "Person",
      "@id": `${ORIGIN}/#person`,
      name: "やんてね",
      url: `${ORIGIN}/about`,
    });
  });

  it("falls back to the default name before the first sync", () => {
    expect(personReference(ORIGIN, null)).toEqual({
      "@type": "Person",
      "@id": `${ORIGIN}/#person`,
      name: FALLBACK_PROFILE_NAME,
      url: `${ORIGIN}/about`,
    });
  });

  it("keeps the history out", () => {
    expect(historyKeysIn(personReference(ORIGIN, PROFILE))).toEqual([]);
  });
});

describe("the history guard itself", () => {
  /* 見張りが実際に落ちることを確かめる。落ちない見張りは、通していても何も守らない。 */
  it("finds a forbidden key at any depth", () => {
    const leaked = { mainEntity: { ...personNode(ORIGIN, PROFILE), alumniOf: "どこかの学校" } };

    expect(historyKeysIn(leaked)).toEqual(["alumniOf"]);
  });
});

describe("profilePageJsonLd", () => {
  /* ページ自身に `@id` は付けない。名札が要るのは、ほかから指される書き手とサイトだけ。 */
  it("wraps the author in a ProfilePage", () => {
    expect(profilePageJsonLd(ORIGIN, PROFILE)).toEqual({
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      url: `${ORIGIN}/about`,
      mainEntity: personNode(ORIGIN, PROFILE),
    });
  });

  it("keeps the history out", () => {
    expect(historyKeysIn(profilePageJsonLd(ORIGIN, PROFILE))).toEqual([]);
  });
});

describe("homeJsonLd", () => {
  it("puts the site and its author in one graph", () => {
    expect(homeJsonLd(ORIGIN, PROFILE)).toEqual({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebSite",
          "@id": `${ORIGIN}/#website`,
          name: "やんてね",
          alternateName: "yantene.net",
          url: `${ORIGIN}/`,
          publisher: { "@id": `${ORIGIN}/#person` },
        },
        personNode(ORIGIN, PROFILE),
      ],
    });
  });

  /*
   * `publisher` は `@id` だけで指している。**指す先が同じ `@graph` に無いと、宙に浮く。**
   */
  it("points the publisher at the person in the same graph", () => {
    const graph = homeJsonLd(ORIGIN, null)["@graph"] as readonly Record<string, unknown>[];
    const [site, person] = graph;

    expect(site?.publisher).toEqual({ "@id": person?.["@id"] });
    expect(person?.["@id"]).toBe(`${ORIGIN}/#person`);
  });

  /*
   * トップは同期の前から index されるページなので、同期の前でも出す。サイト名は
   * 同期と関係が無く、Person は殻だけになる。
   */
  it("still names the site before the first sync", () => {
    const graph = homeJsonLd(ORIGIN, null)["@graph"] as readonly Record<string, unknown>[];

    expect(graph[0]).toMatchObject({ "@type": "WebSite", name: "やんてね" });
    expect(graph[1]).toEqual(personNode(ORIGIN, null));
  });

  it("keeps the history out", () => {
    expect(historyKeysIn(homeJsonLd(ORIGIN, PROFILE))).toEqual([]);
  });
});
