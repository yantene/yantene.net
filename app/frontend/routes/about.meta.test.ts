import { describe, expect, it } from "vitest";
import { meta } from "./about";
import type { PublicProfile } from "~/backend/handlers/profile/profile-view";
import { sampleProfile } from "~/frontend/components/profile/profile-fixture";

/*
 * `/about` の `<title>` と説明文。
 *
 * ページ名の側だけ本名にする (#565)。「About - やんてね」では誰のページかが検索結果から
 * 読めない。**サイト名の側は動かさない** (サイトの名前はサイトの名前)。
 */
const ORIGIN = "https://yantene.net";

const NAMED: PublicProfile = {
  ...sampleProfile,
  name: "吉田 周平",
  displayName: "吉田 周平 (Shuhei YOSHIDA)",
  identity: {
    ...sampleProfile.identity,
    nameEn: "Shuhei YOSHIDA",
    description: "吉田 周平 (よしだ しゅうへい) の個人サイト。",
    descriptionEn: "Personal website of Shuhei YOSHIDA.",
  },
};

type Descriptor = Record<string, string>;

function metaOf(locale: string, profile: PublicProfile | null): readonly Descriptor[] {
  const loaderData = { locale, origin: ORIGIN, profile, jsonLd: {} };
  return (meta({ loaderData, location: { pathname: "/about" } } as never) ?? []) as Descriptor[];
}

function titleOf(descriptors: readonly Descriptor[]): string | undefined {
  return descriptors.find((descriptor) => "title" in descriptor)?.title;
}

function descriptionOf(descriptors: readonly Descriptor[]): string | undefined {
  return descriptors.find((descriptor) => descriptor.name === "description")?.content;
}

describe("/about の <title>", () => {
  it("puts the real name, not the display name, before the site name", () => {
    expect(titleOf(metaOf("ja", NAMED))).toBe("吉田 周平 - やんてね");
  });

  /* 同期の前は誰のページとも言えないので、場所の名前のまま。 */
  it("stays About before the first sync", () => {
    expect(titleOf(metaOf("ja", null))).toBe("About - やんてね");
  });
});

describe("/about の説明文", () => {
  it("uses the machine-facing description when one is written", () => {
    expect(descriptionOf(metaOf("ja", NAMED))).toBe("吉田 周平 (よしだ しゅうへい) の個人サイト。");
  });

  it("uses the English description for an English reader", () => {
    expect(descriptionOf(metaOf("en", NAMED))).toBe("Personal website of Shuhei YOSHIDA.");
  });

  /* 英語の説明文が無ければ日本語のものに、どちらも無ければ短い自己紹介に倒れる。 */
  it("falls back to the Japanese description, then to the tagline", () => {
    const japaneseOnly = { ...NAMED, identity: { ...NAMED.identity, descriptionEn: null } };
    expect(descriptionOf(metaOf("en", japaneseOnly))).toBe(
      "吉田 周平 (よしだ しゅうへい) の個人サイト。",
    );

    expect(descriptionOf(metaOf("ja", sampleProfile))).toBe(sampleProfile.tagline.join(" "));
  });
});
