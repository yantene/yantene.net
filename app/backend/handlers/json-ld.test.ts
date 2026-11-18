import { describe, expect, it } from "vitest";
import type { PublicProfile } from "~/backend/handlers/profile/profile-view";
import {
  collectionPageJsonLd,
  homeJsonLd,
  personId,
  personNode,
  personReference,
  profilePageJsonLd,
  webPageJsonLd,
  websiteReference,
} from "~/backend/handlers/json-ld";
import { FALLBACK_PROFILE_NAME, PROFILE_PHOTO } from "~/lib/profile-fallback";

const ORIGIN = "https://yantene.net";

const PROFILE: PublicProfile = {
  name: "やんてね",
  displayName: "やんてね",
  identity: {
    nameEn: null,
    familyName: null,
    givenName: null,
    alternateNames: [],
    jobTitle: null,
    description: null,
    descriptionEn: null,
  },
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
   * 名前は本名だけ。ハンドルネームと別の表記は `alternateName` に並べる。括弧つきの
   * 表示用の名前 (`displayName`) は機械に名乗らない。
   */
  it("names the author by the real name and lists the other names as alternateName", () => {
    const node = personNode(ORIGIN, {
      ...PROFILE,
      name: "吉田 周平",
      displayName: "吉田 周平 (Shuhei YOSHIDA)",
      identity: {
        nameEn: "Shuhei YOSHIDA",
        familyName: "吉田",
        givenName: "周平",
        // 本名と同じ字と、英語名と重なる字は落ちる。
        alternateNames: ["やんてね", "yantene", "Shuhei YOSHIDA", "吉田 周平"],
        jobTitle: "Web Developer",
        description: "吉田 周平 (よしだ しゅうへい) の個人サイト。",
        descriptionEn: "Personal website of Shuhei YOSHIDA.",
      },
    });

    expect(node).toMatchObject({
      name: "吉田 周平",
      alternateName: ["Shuhei YOSHIDA", "やんてね", "yantene"],
      givenName: "周平",
      familyName: "吉田",
      jobTitle: "Web Developer",
      // 機械向けの説明文が、短い自己紹介より先に採られる。
      description: "吉田 周平 (よしだ しゅうへい) の個人サイト。",
    });
  });

  /* 書いていない欄は欄ごと出さない。空の `alternateName` は「別名は無い」と名乗ることになる。 */
  it("omits the identity fields the writer left out", () => {
    const node = personNode(ORIGIN, PROFILE);

    for (const field of ["alternateName", "givenName", "familyName", "jobTitle"]) {
      expect(node).not.toHaveProperty(field);
    }
  });

  /* 記事と作品が運ぶ参照は、名前と行き先だけ。別名や説明文を記事の数だけ運ばない。 */
  it("keeps the identity fields out of the reference", () => {
    const reference = personReference(ORIGIN, {
      ...PROFILE,
      name: "吉田 周平",
      identity: { ...PROFILE.identity, nameEn: "Shuhei YOSHIDA", alternateNames: ["yantene"] },
    });

    expect(reference).toEqual({
      "@type": "Person",
      "@id": `${ORIGIN}/#person`,
      name: "吉田 周平",
      url: `${ORIGIN}/about`,
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
      isPartOf: { "@id": `${ORIGIN}/#website` },
      mainEntity: personNode(ORIGIN, PROFILE),
    });
  });

  /* 同期の前も出す。主題の書き手は殻だけになる。 */
  it("still names the page before the first sync, around the shell of the author", () => {
    expect(profilePageJsonLd(ORIGIN, null)).toEqual({
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      url: `${ORIGIN}/about`,
      isPartOf: { "@id": `${ORIGIN}/#website` },
      mainEntity: personNode(ORIGIN, null),
    });
  });

  it("keeps the history out", () => {
    expect(historyKeysIn(profilePageJsonLd(ORIGIN, PROFILE))).toEqual([]);
  });
});

describe("collectionPageJsonLd / webPageJsonLd", () => {
  /* 並んでいる中身は写さない。名乗るのは「どこの、何のページか」だけ。 */
  it("names a listing as part of the site and nothing more", () => {
    expect(collectionPageJsonLd(ORIGIN, "/articles")).toEqual({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      url: `${ORIGIN}/articles`,
      isPartOf: websiteReference(ORIGIN),
    });
  });

  it("names any other page as part of the site and nothing more", () => {
    expect(webPageJsonLd(ORIGIN, "/legal")).toEqual({
      "@context": "https://schema.org",
      "@type": "WebPage",
      url: `${ORIGIN}/legal`,
      isPartOf: websiteReference(ORIGIN),
    });
  });
});

describe("websiteReference", () => {
  /*
   * 記事と `/about` が指す先は、トップが名乗る `WebSite` の `@id` と同じ綴りでなければ
   * ならない。ずれると、どこにも無いサイトを指すことになる。
   */
  it("points at the WebSite the home page declares", () => {
    const [site] = homeJsonLd(ORIGIN, null)["@graph"] as readonly Record<string, unknown>[];

    expect(websiteReference(ORIGIN)).toEqual({ "@id": `${ORIGIN}/#website` });
    expect(websiteReference(ORIGIN)).toEqual({ "@id": site?.["@id"] });
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
          alternateName: ["yantene", "yantene.net"],
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
