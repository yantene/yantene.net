import { describe, expect, it } from "vitest";
import { createTestApp } from "~/backend/test-app";

const ORIGIN = "https://yantene.net";

function get(path: string, init: RequestInit = {}): Promise<Response> {
  return Promise.resolve(createTestApp().request(`${ORIGIN}${path}`, init, {}));
}

/*
 * 末尾にスラッシュの付いた URL は、付かない URL へ送る (#569)。同じ中身が 2 つの URL で
 * 引けると、canonical・`og:url`・構造化データの `url` が 1 つのページの中で食い違う。
 */
describe("redirectTrailingSlash (full app)", () => {
  it.each([
    ["/articles/", "/articles"],
    ["/about/", "/about"],
    ["/works/infoholick/", "/works/infoholick"],
    ["/articles/hello/", "/articles/hello"],
    // 重ねて付いていても 1 回で送り切る。
    ["/articles///", "/articles"],
  ])("%s を %s へ 308 で送る", async (from, to) => {
    const res = await get(from);

    expect(res.status).toBe(308);
    expect(res.headers.get("Location")).toBe(`${ORIGIN}${to}`);
  });

  /* Hono が先に答える経路も同じ。末尾にスラッシュが付くとどれにも当たらず、ここで送られる。 */
  it.each([
    ["/feed.xml/", "/feed.xml"],
    ["/api/v1/articles/", "/api/v1/articles"],
    ["/og/default/", "/og/default"],
  ])("ページ以外の %s も %s へ送る", async (from, to) => {
    const res = await get(from);

    expect(res.status).toBe(308);
    expect(res.headers.get("Location")).toBe(`${ORIGIN}${to}`);
  });

  it("クエリを保つ", async () => {
    const res = await get("/articles/?q=flip&page=2");

    expect(res.status).toBe(308);
    expect(res.headers.get("Location")).toBe(`${ORIGIN}/articles?q=flip&page=2`);
  });

  it("HEAD も送る", async () => {
    const res = await get("/articles/", { method: "HEAD" });

    expect(res.status).toBe(308);
  });

  /* ルートは、末尾のスラッシュを落とすと空になる。そこは URL そのもの。 */
  it("ルートは送らない", async () => {
    const res = await get("/");

    expect(res.status).not.toBe(308);
  });

  it.each(["/articles", "/health", "/feed.xml", "/articles/hello.md"])(
    "末尾にスラッシュの無い %s は送らない",
    async (path) => {
      const res = await get(path);

      expect(res.status).not.toBe(308);
    },
  );

  /*
   * 旧 URL は、末尾にスラッシュが付いたままでも 1 回で新しい URL へ送る (2 段跳びに
   * しない)。昔のリンクは末尾にスラッシュが付いていることが多い。
   */
  it("旧 URL のリダイレクトを追い越さない", async () => {
    const res = await get("/notes/back-from-times/");

    expect(res.status).toBe(308);
    expect(res.headers.get("Location")).toBe("/articles/back-from-times");
  });

  /* 書き込みの要求を、別の URL へ送り直させない。 */
  it("POST は送らない", async () => {
    const res = await get("/webmention/", { method: "POST" });

    expect(res.status).not.toBe(308);
  });

  /*
   * ⚠️ オープンリダイレクトにしない。`//evil.example/` の末尾を落として `Location` に
   * そのまま書くと `//evil.example` になり、ブラウザは別のホストへ飛ぶ。
   */
  it("別のホストへは送らない", async () => {
    const res = await get("//evil.example/");

    expect(res.status).toBe(308);
    const location = res.headers.get("Location") ?? "";
    expect(new URL(location).origin).toBe(ORIGIN);
    expect(location.startsWith("//")).toBe(false);
  });

  /* staging の壁の内側に置く。認証の前に行き先 (どの URL が在るか) を答えない。 */
  it("BASIC 認証が先に効く", async () => {
    const env = { BASIC_AUTH_USER: "u", BASIC_AUTH_PASS: "p" } as unknown as Env;

    const res = await createTestApp().request(`${ORIGIN}/articles/`, {}, env);

    expect(res.status).toBe(401);
  });
});
