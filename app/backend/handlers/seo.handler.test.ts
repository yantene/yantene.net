import { describe, expect, it } from "vitest";
import { Profile, ProfileName, Tagline } from "~/backend/domain/profile";
import { D1ProfileCommandRepository } from "~/backend/infra/d1/repositories";
import { createTestD1 } from "~/backend/infra/d1/test-helper";
import { createTestApp } from "~/backend/test-app";

function envFor(options: { readonly private: boolean }): Env {
  return {
    D1: createTestD1(),
    APP_ENV: "test",
    ...(options.private ? { BASIC_AUTH_USER: "user", BASIC_AUTH_PASS: "pass" } : {}),
  } as unknown as Env;
}

describe("GET /robots.txt", () => {
  it("公開環境では sitemap を案内し、ログインの入口だけ断る", async () => {
    const response = await createTestApp().request(
      "https://yantene.net/robots.txt",
      {},
      envFor({ private: false }),
    );
    const body = await response.text();

    expect(body).toContain("Allow: /");
    expect(body).toContain("Disallow: /sign-in");
    expect(body).toContain("Sitemap: https://yantene.net/sitemap.xml");
  });

  /*
   * staging は BASIC 認証が有効 = 非公開環境。存在ベースで確実にクロールを止める。
   */
  it("非公開環境では丸ごと断る", async () => {
    const response = await createTestApp().request(
      "https://staging.yantene.net/robots.txt",
      { headers: { authorization: `Basic ${btoa("user:pass")}` } },
      envFor({ private: true }),
    );
    const body = await response.text();

    expect(body).toBe("User-agent: *\nDisallow: /\n");
  });
});

describe("GET /sitemap.xml", () => {
  /** ログインの入口は中身ではないので、そもそも載せない。 */
  it("ログインの入口は載せない", async () => {
    const response = await createTestApp().request(
      "https://yantene.net/sitemap.xml",
      {},
      envFor({ private: false }),
    );

    expect(await response.text()).not.toContain("/sign-in");
  });

  /*
   * `/about` はプロフィールが同期されるまで `noindex` の「準備中」になる。載せたまま
   * `noindex` を出すと、Search Console が「sitemap に出した URL が noindex」と言ってくる。
   * 同じ理由で `/notes` と `/slides` も載せていない。
   */
  it("プロフィールが同期されるまで /about は載せない", async () => {
    const response = await createTestApp().request(
      "https://yantene.net/sitemap.xml",
      {},
      envFor({ private: false }),
    );

    expect(await response.text()).not.toContain("/about");
  });

  it("プロフィールが入れば /about を載せる", async () => {
    const d1 = createTestD1();
    await new D1ProfileCommandRepository(d1).upsert(
      Profile.create({
        name: ProfileName.create("やんてね"),
        tagline: Tagline.create("短い自己紹介。"),
        avatarUrl: undefined,
        socials: [],
        lifeEvents: [],
        sourceHash: "h1",
      }),
    );
    const response = await createTestApp().request(
      "https://yantene.net/sitemap.xml",
      {},
      {
        D1: d1,
        APP_ENV: "test",
      },
    );

    expect(await response.text()).toContain("<loc>https://yantene.net/about</loc>");
  });
});
