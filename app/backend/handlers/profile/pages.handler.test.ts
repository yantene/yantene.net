import type { Root } from "mdast";
import { describe, expect, it } from "vitest";
import { loadAboutPage, loadProfile } from "./pages.handler";
import { Profile, ProfileName, SocialAccount, Tagline } from "~/backend/domain/profile";
import { Work, WorkName, WorkSlug, WorkSummary } from "~/backend/domain/work";
import {
  D1ProfileCommandRepository,
  D1WorkCommandRepository,
} from "~/backend/infra/d1/repositories";
import { createTestD1 } from "~/backend/infra/d1/test-helper";
import { PROFILE_PHOTO } from "~/lib/profile-fallback";
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
      socials: [
        SocialAccount.create({ platform: "github", url: "https://github.com/yantene", isMe: true }),
        SocialAccount.create({ platform: "x", url: "https://x.com/yantene", isMe: false }),
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
  });

  /*
   * ページごと「準備中」の一枚に倒れるので、作品だけ返しても出る場所が無い。
   * `noindex` を立てたページに中身がある、というちぐはぐも作らない。
   */
  it("returns no works while the profile is missing", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await new D1WorkCommandRepository(d1).upsert(
      Work.create({
        slug: WorkSlug.create("infoholick"),
        name: WorkName.create("infoholick"),
        summary: WorkSummary.create("読んだものを覚えておくやつ。"),
        position: 0,
        sourceHash: "h1",
      }),
    );

    const data = await loadAboutPage(envWith(d1, bucket), ORIGIN);
    expect(data.profile).toBeNull();
    expect(data.works).toEqual([]);
  });

  it("returns the works alongside the profile", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seedProfile(d1);
    await new R2ProfileContentCache(bucket).putMdast(BODY);
    await new D1WorkCommandRepository(d1).upsert(
      Work.create({
        slug: WorkSlug.create("infoholick"),
        name: WorkName.create("infoholick"),
        summary: WorkSummary.create("読んだものを覚えておくやつ。"),
        position: 0,
        sourceHash: "h1",
      }),
    );

    const data = await loadAboutPage(envWith(d1, bucket), ORIGIN);
    expect(data.works.map((work) => work.slug)).toEqual(["infoholick"]);
  });

  it("returns the profile and its body", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seedProfile(d1);
    await new R2ProfileContentCache(bucket).putMdast(BODY);

    const data = await loadAboutPage(envWith(d1, bucket), ORIGIN);

    expect(data.profile?.name).toBe("やんてね");
    expect(data.profile?.tagline).toEqual(["東京で Web 開発者をやっています。"]);
    expect(data.mdast).toEqual(BODY);
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
      image: `${ORIGIN}${PROFILE_PHOTO}`,
      sameAs: ["https://github.com/yantene"],
    });
  });

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

  it("returns the short profile", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seedProfile(d1);

    const profile = await loadProfile(envWith(d1, bucket));
    expect(profile?.name).toBe("やんてね");
    expect(profile?.socials.map((social) => social.platform)).toEqual(["github", "x"]);
  });

  /*
   * 保存されている行が読めなくなる筋がある。`social-platforms.ts` から先を 1 つ落とせば、
   * その先を持つ既存の行は VO に戻せない。しかも同期は読めないフロントマターを弾いて
   * 旧行を残すので、コンテンツ側を直しても消えない。ここで投げると、プロフィールを
   * 読むだけのトップと**全記事ページ**が巻き添えで 500 になる。
   */
  it("falls back to null when a stored row can no longer be read", async () => {
    const d1 = createTestD1();
    const { bucket } = createTestR2();
    await seedProfile(d1);
    await d1
      .prepare("UPDATE profile_socials SET platform = ? WHERE profile_id = ?")
      .bind("retired-platform", "profile")
      .run();

    expect(await loadProfile(envWith(d1, bucket))).toBeNull();
  });

  /** D1 そのものの障害は握りつぶさない (静かに「プロフィールが無い」ことにしない)。 */
  it("rethrows when D1 itself fails", async () => {
    const failing = {
      prepare: () => {
        throw new Error("D1_ERROR: no such table");
      },
    } as unknown as D1Database;
    const { bucket } = createTestR2();

    await expect(loadProfile(envWith(failing, bucket))).rejects.toThrow("D1_ERROR");
  });
});
