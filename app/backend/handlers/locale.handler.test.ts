import { describe, expect, it } from "vitest";
import { buildLocaleCookie, safeReturnTo } from "./locale.handler";
import { createTestApp } from "~/backend/test-app";
import { localeCookieName, localeField, localePath, localeReturnToField } from "~/lib/i18n/locale";

function env(appEnv: string): Env {
  return { APP_ENV: appEnv } as unknown as Env;
}

/**
 * 素通りを確かめるケースで要る。表に無い要求は React Router へ委譲され、
 * 委譲ハンドラが ExecutionContext を読む (無いと 500 になり素通りを観測できない)。
 */
function executionCtx(): ExecutionContext {
  return {
    waitUntil: () => {},
    passThroughOnException: () => {},
  } as unknown as ExecutionContext;
}

function form(fields: Record<string, string>): FormData {
  const body = new FormData();
  for (const [name, value] of Object.entries(fields)) body.append(name, value);
  return body;
}

async function post(fields: Record<string, string>, appEnv = "production"): Promise<Response> {
  return createTestApp().request(localePath, { method: "POST", body: form(fields) }, env(appEnv));
}

describe("safeReturnTo", () => {
  it("同一オリジンのパスはそのまま通す", () => {
    expect(safeReturnTo("/articles?q=arch")).toBe("/articles?q=arch");
  });

  it("行き先を言ってこなければトップに戻す", () => {
    expect(safeReturnTo(undefined)).toBe("/");
    expect(safeReturnTo("")).toBe("/");
  });

  it("絶対 URL は外へ飛ばす踏み台になるので落とす", () => {
    expect(safeReturnTo("https://evil.example/")).toBe("/");
  });

  /*
   * `//` と `/\` はスキーム相対 URL としてブラウザに読まれ、先頭が `/` でも別の
   * オリジンへ飛ぶ。`startsWith("/")` だけの判定では漏れるので、ここで固定する。
   */
  it("スキーム相対 URL も落とす", () => {
    expect(safeReturnTo("//evil.example/")).toBe("/");
    expect(safeReturnTo("/\\evil.example/")).toBe("/");
  });

  it("ヘッダーに載せられない制御文字を含むものは落とす", () => {
    expect(safeReturnTo("/articles\r\nSet-Cookie: a=b")).toBe("/");
  });

  /*
   * ヘッダーの値は ByteString で、255 を越える符号位置はそこで例外になる。手前で
   * 落とさないと、`/記事` を送られただけで応答の組み立てが落ちて 500 になる。
   * 素のフォームからは百分率符号化済みの値しか来ないので、これで困る経路は無い。
   */
  it("ASCII の外の文字を含むものも落とす (ヘッダーに載らない)", () => {
    expect(safeReturnTo("/記事")).toBe("/");
    expect(safeReturnTo("/articles?q=%E8%A8%98%E4%BA%8B")).toBe("/articles?q=%E8%A8%98%E4%BA%8B");
  });
});

/*
 * cookie は組み立てる関数のほうで確かめる。
 *
 * **応答から読み出せない。** テストは happy-dom の上で走り、そこの `Response` は
 * ブラウザと同じく `Set-Cookie` を保持しない (仕様上、応答ヘッダーから読めない)。
 * 経路を通した確認は staging のスモークが受け持つ (session-cookie.test.ts も同じ形)。
 */
describe("buildLocaleCookie", () => {
  it("選ばれたロケールを、サイト全体に効く形で置く", () => {
    const cookie = buildLocaleCookie("ja", { secure: true });

    expect(cookie).toContain(`${localeCookieName}=ja`);
    expect(cookie).toContain("Path=/");
    // 他所からの遷移でも送ってほしい (リンクを踏んで来た人にも選んだ言語で出す)。
    expect(cookie).toContain("SameSite=Lax");
  });

  it("1 年は覚えておく", () => {
    expect(buildLocaleCookie("en", { secure: true })).toContain("Max-Age=31536000");
  });

  it("secure を言われたら Secure を付ける", () => {
    expect(buildLocaleCookie("en", { secure: true })).toContain("Secure");
    expect(buildLocaleCookie("en", { secure: false })).not.toContain("Secure");
  });

  /*
   * 表示の好みでしかなく、盗まれて困るものが入っていない。読める状態にしておくと、
   * 後からクライアント側だけで切り替える手を足せる。
   */
  it("HttpOnly は付けない", () => {
    expect(buildLocaleCookie("ja", { secure: true })).not.toContain("HttpOnly");
  });
});

describe("POST /locale", () => {
  it("元のページへ 303 で戻す", async () => {
    const response = await post({ [localeField]: "ja", [localeReturnToField]: "/articles?q=arch" });

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/articles?q=arch");
  });

  /*
   * 読めない値を既定に倒さない。倒すと、綴りを間違えたフォームが「押しても英語のまま」
   * という形でだけ壊れ、誰も原因に辿り着けない (fail-loud)。
   */
  it("知らないロケールは 400 にする", async () => {
    const response = await post({ [localeField]: "fr" });

    expect(response.status).toBe(400);
    expect(response.headers.get("Content-Type")).toContain("application/problem+json");
  });

  it("ロケールを言ってこなければ 400", async () => {
    expect((await post({ [localeReturnToField]: "/" })).status).toBe(400);
  });

  /*
   * フォームとして読めない本文も 400。握らないと `formData()` の例外が onError まで
   * 転がって 500 になり、**押した人の側の間違いをこちらの故障として報せる**ことになる。
   */
  it("フォームとして読めない本文は 400", async () => {
    const response = await createTestApp().request(
      localePath,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      },
      env("production"),
    );

    expect(response.status).toBe(400);
  });

  it("外へ飛ばそうとする戻り先は、切り替えは通したうえでトップに落とす", async () => {
    const response = await post({
      [localeField]: "ja",
      [localeReturnToField]: "https://evil.example/",
    });

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/");
  });

  /*
   * GET では切り替えない。リンクの先読みや事前取得で勝手に言語が変わらないようにする
   * ため。ここが素通りすると React Router のページ描画へ落ち、委譲先のダミーが 404 を返す。
   */
  it("GET は受けない", async () => {
    const response = await createTestApp().request(
      localePath,
      {},
      env("production"),
      executionCtx(),
    );

    expect(response.status).toBe(404);
  });
});
