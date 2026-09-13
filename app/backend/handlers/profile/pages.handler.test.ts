import type { Root } from "mdast";
import { describe, expect, it } from "vitest";
import { loadAboutPage, loadProfile } from "./pages.handler";
import {
  LifeEvent,
  LifeEventDate,
  Profile,
  ProfileName,
  SocialAccount,
  Tagline,
} from "~/backend/domain/profile";
import { ImageUrl } from "~/backend/domain/shared";
import { D1ProfileCommandRepository } from "~/backend/infra/d1/repositories";
import { createTestD1 } from "~/backend/infra/d1/test-helper";
import { R2ProfileContentCache } from "~/backend/infra/r2/r2-profile-content-cache";
import { createTestR2 } from "~/backend/infra/r2/test-helper";

const ORIGIN = "https://yantene.net";

const BODY: Root = {
  type: "root",
  children: [{ type: "paragraph", children: [{ type: "text", value: "長い自己紹介。" }] }],
};

function envWith(d1: D1Database, bucket: R2Bucket): Env {
  return { D1: d1, R2: bucket } as unknown as Env;
}

async function seedProfile(d1: D1Database): Promise<void> {
  await new D1ProfileCommandRepository(d1).upsert(
    Profile.create({
      name: ProfileName.create("やんてね"),
      tagline: Tagline.create("東京で Web 開発者をやっています。"),
      avatarUrl: ImageUrl.create("/api/v1/profile/assets/avatar.png"),
      socials: [
        SocialAccount.create({ platform: "github", url: "https://github.com/yantene", isMe: true }),
        SocialAccount.create({ platform: "x", url: "https://x.com/yantene", isMe: false }),
      ],
      lifeEvents: [
        LifeEvent.create({
          date: LifeEventDate.create("1993-11-18"),
          kind: "birth",
          title: "生誕",
        }),
      ],
      sourceHash: "h1",
    }),
  );
}

describe("loadAboutPage", () => {
  /*
   * ナビが常に指している行き先なので、初回同期の前に「そんなページは無い」と答えない。
   * ページ側が「準備中」に倒れる。
   */
  it("returns an empty page before the first sync", async () => {
    const { bucket } = createTestR2();
    const data = await loadAboutPage(envWith(createTestD1(), bucket), ORIGIN);

    expect(data.profile).toBeNull();
    expect(data.mdast).toBeNull();
    expect(data.jsonLd).toBeNull();
    expect(data.lifeEvents).toEqual([]);
  });

  it("returns the profile, its body and its life events", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seedProfile(d1);
    await new R2ProfileContentCache(bucket).putMdast(BODY);

    const data = await loadAboutPage(envWith(d1, bucket), ORIGIN);

    expect(data.profile?.name).toBe("やんてね");
    expect(data.profile?.tagline).toEqual(["東京で Web 開発者をやっています。"]);
    expect(data.mdast).toEqual(BODY);
    expect(data.lifeEvents).toEqual([
      {
        date: "1993-11-18",
        precision: "day",
        kind: "birth",
        title: "生誕",
        description: null,
      },
    ]);
  });

  /** sameAs に並べるのは、自分のものだと主張できる先だけ (h-card の rel="me" と同じ線引き)。 */
  it("builds Person JSON-LD with only the reciprocal links", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seedProfile(d1);
    await new R2ProfileContentCache(bucket).putMdast(BODY);

    const { jsonLd } = await loadAboutPage(envWith(d1, bucket), ORIGIN);

    expect(jsonLd).toMatchObject({
      "@type": "Person",
      name: "やんてね",
      url: `${ORIGIN}/about`,
      image: `${ORIGIN}/api/v1/profile/assets/avatar.png`,
      sameAs: ["https://github.com/yantene"],
    });
  });

  /** D1 に行があるのに本文が無いのは同期の壊れ方。黙って空のページを出さない。 */
  it("fails loudly when the body is missing from R2", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seedProfile(d1);

    await expect(loadAboutPage(envWith(d1, bucket), ORIGIN)).rejects.toThrow("missing from R2");
  });
});

describe("loadProfile", () => {
  it("returns null before the first sync", async () => {
    const { bucket } = createTestR2();
    expect(await loadProfile(envWith(createTestD1(), bucket))).toBeNull();
  });

  /** トップと記事末尾が読む短いほう。ライフイベントは運ばない。 */
  it("returns the short profile without life events", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seedProfile(d1);

    const profile = await loadProfile(envWith(d1, bucket));
    expect(profile?.name).toBe("やんてね");
    expect(profile?.socials.map((social) => social.platform)).toEqual(["github", "x"]);
    expect(profile).not.toHaveProperty("lifeEvents");
  });
});
