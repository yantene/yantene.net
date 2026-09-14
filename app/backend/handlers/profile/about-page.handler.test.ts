import { describe, expect, it } from "vitest";
import { loadAboutPage } from "./about-page.handler";
import type { Profile } from "~/backend/domain/profile";
import { ProfileName, Profile as ProfileEntity } from "~/backend/domain/profile";
import { D1ProfileCommandRepository } from "~/backend/infra/d1/repositories";
import { createTestD1 } from "~/backend/infra/d1/test-helper";
import { createTestR2 } from "~/backend/infra/r2/test-helper";
import { R2ProfileContentCache } from "~/backend/infra/r2/r2-profile-content-cache";
import { Temporal } from "@js-temporal/polyfill";

const ORIGIN = "https://yantene.net";

const MDAST = { type: "root", children: [] };

function profile(): Profile {
  return ProfileEntity.create({
    name: ProfileName.create("吉田 周平 (Shuhei YOSHIDA)"),
    dateOfBirth: Temporal.PlainDate.from("1993-11-18"),
    birthplace: "愛知県刈谷市",
    tagline: "一介のコンピュータ好き。\n東京で Web 開発をしている。",
    socials: [
      { platform: "github", url: "https://github.com/yantene", isMe: true },
      { platform: "discord", url: "https://discord.com/users/yantene", isMe: false },
    ],
    sourceHash: "h1",
  });
}

function env(): { env: Env; d1: D1Database; r2: R2Bucket } {
  const d1 = createTestD1();
  const r2 = createTestR2().bucket;
  return { env: { D1: d1, R2: r2 } as unknown as Env, d1, r2 };
}

describe("loadAboutPage", () => {
  it("D1 の行と R2 の本文を揃えて返す", async () => {
    const { env: bindings, d1, r2 } = env();
    await new D1ProfileCommandRepository(d1).save(profile());
    await new R2ProfileContentCache(r2).putMdast(MDAST);

    const data = await loadAboutPage(bindings, ORIGIN);

    expect(data.profile?.name).toBe("吉田 周平 (Shuhei YOSHIDA)");
    expect(data.profile?.dateOfBirth).toBe("1993-11-18");
    expect(data.mdast).toEqual(MDAST);
  });

  it("まだ同期していなければ何も返さない", async () => {
    const { env: bindings } = env();

    expect(await loadAboutPage(bindings, ORIGIN)).toEqual({
      profile: null,
      mdast: null,
      jsonLd: undefined,
    });
  });

  it("行があるのに本文が無ければ「準備中」に倒す", async () => {
    /*
     * 同期が途中で落ちた姿。片方だけで描くと、名乗りだけがあって中身の無いページに
     * なる (ADR 0041 の書き込みの順から、この向きにしか壊れない)。
     */
    const { env: bindings, d1 } = env();
    await new D1ProfileCommandRepository(d1).save(profile());

    expect((await loadAboutPage(bindings, ORIGIN)).profile).toBeNull();
  });

  describe("Person の構造化データ", () => {
    it("生年月日と出身地を載せる", async () => {
      const { env: bindings, d1, r2 } = env();
      await new D1ProfileCommandRepository(d1).save(profile());
      await new R2ProfileContentCache(r2).putMdast(MDAST);

      const { jsonLd } = await loadAboutPage(bindings, ORIGIN);

      expect(jsonLd).toMatchObject({
        "@type": "Person",
        name: "吉田 周平 (Shuhei YOSHIDA)",
        birthDate: "1993-11-18",
        birthPlace: "愛知県刈谷市",
        url: `${ORIGIN}/about`,
      });
      // 自己紹介は 1 行に畳む (検索結果も OGP も改行を出さない)。
      expect(jsonLd?.description).toBe("一介のコンピュータ好き。 東京で Web 開発をしている。");
    });

    it("sameAs に並べるのは isMe を立てた先だけ", async () => {
      /*
       * 画面の `rel="me"` と同じ判定にする。揃えないと、画面では主張していない先を
       * 機械にだけ主張することになる。
       */
      const { env: bindings, d1, r2 } = env();
      await new D1ProfileCommandRepository(d1).save(profile());
      await new R2ProfileContentCache(r2).putMdast(MDAST);

      const { jsonLd } = await loadAboutPage(bindings, ORIGIN);

      expect(jsonLd?.sameAs).toEqual(["https://github.com/yantene"]);
    });
  });
});
