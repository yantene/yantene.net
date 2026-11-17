import { describe, expect, it } from "vitest";
import { Profile, ProfileName, Tagline } from "~/backend/domain/profile";
import { Work, WorkName, WorkSlug, WorkSummary } from "~/backend/domain/work";
import {
  D1ProfileCommandRepository,
  D1WorkCommandRepository,
} from "~/backend/infra/d1/repositories";
import { seedSlide } from "~/backend/handlers/slides/test-seed";
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
   * 同じ理由で `/notes` も載せていない (`/slides` はスライドが 1 本以上あるときだけ載せる)。
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
        socials: [],
        sourceHash: "h1",
      }),
      [],
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

  /** `/works` も 1 件も無ければ `noindex` の「準備中」になる。`/about` と同じ扱い。 */
  it("作品が 1 件も無ければ /works は載せない", async () => {
    const response = await createTestApp().request(
      "https://yantene.net/sitemap.xml",
      {},
      envFor({ private: false }),
    );

    expect(await response.text()).not.toContain("/works");
  });

  it("作品が入れば /works と各作品を載せる", async () => {
    const d1 = createTestD1();
    await new D1WorkCommandRepository(d1).upsert(
      Work.create({
        slug: WorkSlug.create("infoholick"),
        name: WorkName.create("infoholick"),
        summary: WorkSummary.create("読んだものを覚えておくやつ。"),
        position: 0,
        sourceHash: "h1",
      }),
    );
    const response = await createTestApp().request(
      "https://yantene.net/sitemap.xml",
      {},
      { D1: d1, APP_ENV: "test" },
    );
    const body = await response.text();

    expect(body).toContain("<loc>https://yantene.net/works</loc>");
    expect(body).toContain("<loc>https://yantene.net/works/infoholick</loc>");
  });

  /** `/slides` も 1 本も無ければ `noindex` の「準備中」になる。`/works` と同じ扱い。 */
  it("スライドが 1 本も無ければ /slides は載せない", async () => {
    const response = await createTestApp().request(
      "https://yantene.net/sitemap.xml",
      {},
      envFor({ private: false }),
    );

    expect(await response.text()).not.toContain("/slides");
  });

  it("スライドが入れば /slides と各スライドを載せる", async () => {
    const d1 = createTestD1();
    await seedSlide(d1, { publishedOn: "2026-11-14" });
    const response = await createTestApp().request(
      "https://yantene.net/sitemap.xml",
      {},
      { D1: d1, APP_ENV: "test" },
    );
    const body = await response.text();

    expect(body).toContain("<url><loc>https://yantene.net/slides</loc></url>");
    // lastmod は出した日 (直した日は持っていない)。
    expect(body).toContain(
      "<url><loc>https://yantene.net/slides/semantic-slides</loc><lastmod>2026-11-14</lastmod></url>",
    );
  });

  /* 公開範囲 (ADR 0040)。sitemap に載せるスライドは published だけ。 */
  it("published 以外のスライドは載せない", async () => {
    const d1 = createTestD1();
    for (const status of ["published", "unlisted", "withdrawn", "draft", "idea"] as const) {
      await seedSlide(d1, { slug: `a-${status}`, status });
    }
    const response = await createTestApp().request(
      "https://yantene.net/sitemap.xml",
      {},
      { D1: d1, APP_ENV: "test" },
    );
    const body = await response.text();

    expect(body).toContain("https://yantene.net/slides/a-published<");
    for (const hidden of ["unlisted", "withdrawn", "draft", "idea"]) {
      expect(body).not.toContain(`/slides/a-${hidden}`);
    }
  });

  /* 出しているものが 1 本も無ければ `/slides` は「準備中」。下書きだけでは載せない。 */
  it("下書きしか無ければ /slides も載せない", async () => {
    const d1 = createTestD1();
    await seedSlide(d1, { status: "draft" });
    const response = await createTestApp().request(
      "https://yantene.net/sitemap.xml",
      {},
      { D1: d1, APP_ENV: "test" },
    );

    expect(await response.text()).not.toContain("/slides");
  });
});
