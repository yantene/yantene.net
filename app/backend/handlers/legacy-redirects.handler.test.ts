import { describe, expect, it } from "vitest";
import { noteSlugByLegacySlug } from "./legacy-redirects.handler";
import { createTestApp } from "~/backend/test-app";

function env(): Env {
  return {} as unknown as Env;
}

/**
 * 素通りを検証するケースで必要になる。表に無いパスは React Router へ委譲され、
 * 委譲ハンドラが ExecutionContext を読むため (無いと 500 になり素通りを観測できない)。
 */
function executionCtx(): ExecutionContext {
  return {
    waitUntil: () => {},
    passThroughOnException: () => {},
  } as unknown as ExecutionContext;
}

/**
 * 旧サイトの記事 URL と移転先の対応表。実装の表とは別に、仕様としてここに書き下す
 * (取り違え・取りこぼしをテスト側から独立に押さえるため)。
 */
/* eslint-disable no-secrets/no-secrets -- 旧記事のスラグを高エントロピーの秘匿情報と誤検知するため、表だけを囲んで無効化する (秘密は含まない)。 */
const noteRedirects: readonly (readonly [string, string])[] = [
  ["/i_bought_arduino.html", "/notes/arduino-one-minute-timer"],
  ["/sugoroku_by_c.html", "/notes/sugoroku-in-c"],
  ["/one_month_before_the_fe_exam.html", "/notes/one-month-until-fe-exam"],
  ["/aichi_breaker.html", "/notes/aichi-breaker"],
  ["/passed_fe_exam.html", "/notes/passed-fe-exam"],
  ["/first_challenge_of_topcoder.html", "/notes/first-topcoder-practice"],
  ["/practice_of_topcoder.html", "/notes/topcoder-practice-after-exams"],
  ["/first_challenge_of_srm.html", "/notes/first-topcoder-srm"],
  ["/practice_practice.html", "/notes/topcoder-srm153-div2-250"],
  ["/combsort.html", "/notes/comb-sort-in-java"],
  ["/opencobol_in_ubuntu.html", "/notes/install-opencobol-on-ubuntu"],
  ["/clang_for_joi.html", "/notes/back-to-c-for-joi"],
  ["/amidakuji.html", "/notes/amidakuji-in-c"],
  ["/joi2009_yosen_q4.html", "/notes/joi-2009-qual-q4"],
  ["/joi2009_yosen_q5_failed.html", "/notes/joi-2009-qual-q5-failed"],
  ["/amidakuji_by_cobol.html", "/notes/amidakuji-in-cobol"],
  ["/joi2009_yosen_q5_succeed.html", "/notes/joi-2009-qual-q5-solved"],
  ["/passed_ap_exam.html", "/notes/passed-ap-exam"],
  ["/svt1311aj_linux_brightness_adjustment.html", "/notes/vaio-svt1311aj-brightness-on-linux"],
  ["/code_thanks_festival_2014.html", "/notes/code-thanks-festival-2014"],
  ["/install_arch_linux_on_uefi_machine.html", "/notes/install-arch-linux-on-vaio-pro"],
  ["/tut_tani_checker.html", "/notes/tut-credit-checker"],
  ["/tut_photographs.html", "/notes/tut-in-photos"],
  ["/install_arch_on_kvi-70b.html", "/notes/install-arch-linux-on-kvi-70b"],
  ["/hacku_2016.html", "/notes/hacku-2016"],
  ["/use_tutvpn_wisely.html", "/notes/tut-vpn-with-ocproxy"],
  ["/invitation_to_flared.html", "/notes/invitation-to-flared"],
];
/* eslint-enable no-secrets/no-secrets */

describe("legacy note URLs", () => {
  // 実装の表に余分なエントリが紛れると、404 になる URL への恒久リダイレクトが
  // 読者のブラウザに焼き付く。件数を実装側から取って突き合わせる。
  it("covers every article of the old site and nothing else", () => {
    expect(noteRedirects).toHaveLength(27);
    expect(noteSlugByLegacySlug.size).toBe(noteRedirects.length);
  });

  it.each(noteRedirects)("permanently redirects %s to %s", async (from, to) => {
    const res = await createTestApp().request(from, {}, env());

    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe(to);
  });

  it("lets an unknown .html fall through to the page router", async () => {
    const res = await createTestApp().request("/never_published.html", {}, env(), executionCtx());

    expect(res.status).toBe(404);
  });

  // Hono は HEAD を GET として dispatch するので、GET だけの登録で HEAD にも応える。
  it("answers a HEAD request the same way", async () => {
    const res = await createTestApp().request("/combsort.html", { method: "HEAD" }, env());

    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("/notes/comb-sort-in-java");
  });

  it("caches the redirect under the same rule as note content", async () => {
    const res = await createTestApp().request("/combsort.html", {}, env());

    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
  });

  /*
   * ルート直下でカスタム正規表現のパラメータを使うと、Hono の SmartRouter が
   * RegExpRouter を諦めて TrieRouter に落ち、この 27 本のためにアプリ全体のリクエストが
   * 遅いマッチャーを通ることになる。記事を静的パスで登録している理由をここで固定する。
   */
  it("keeps the whole app on the faster router", async () => {
    const app = createTestApp();
    await app.request("/combsort.html", {}, env());

    expect(app.router.name).toBe("SmartRouter + RegExpRouter");
  });
});

describe("legacy pages other than articles", () => {
  it.each([
    ["/index.html", "/"],
    ["/profile.html", "/"],
    ["/atom.xml", "/feed.xml"],
    ["/list.html", "/notes"],
  ])("permanently redirects %s to %s", async (from, to) => {
    const res = await createTestApp().request(from, {}, env());

    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe(to);
  });

  it("carries the tag of the old article list over to the note list", async () => {
    const res = await createTestApp().request("/list.html?tag=%E6%97%A5%E8%A8%98", {}, env());

    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("/notes?tag=%E6%97%A5%E8%A8%98");
  });

  // 旧サイトのタグには `GNU/Linux` のようにスラッシュを含むものがある。
  /* eslint-disable no-secrets/no-secrets -- 符号化したタグ名を高エントロピーの秘匿情報と誤検知するため (秘密は含まない)。 */
  it("escapes a slash inside a tag", async () => {
    const res = await createTestApp().request("/list.html?tag=GNU%2FLinux", {}, env());

    expect(res.headers.get("location")).toBe("/notes?tag=GNU%2FLinux");
  });
  /* eslint-enable no-secrets/no-secrets */
});

describe("legacy image URLs", () => {
  it("redirects an article image to the asset API", async () => {
    const res = await createTestApp().request(
      "/images/2016-09-26-hacku_2016/scream2.png",
      {},
      env(),
    );

    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("/api/v1/notes/hacku-2016/assets/scream2.png");
  });

  /*
   * パスパラメータは復号済みで届く。素通しすると `#` 以降が fragment に化けて
   * 別のリソースを指し、その 404 がキャッシュされてしまう。
   */
  it("re-encodes characters that would change the target", async () => {
    const res = await createTestApp().request("/images/2016-09-26-hacku_2016/a%23b.png", {}, env());

    expect(res.headers.get("location")).toBe("/api/v1/notes/hacku-2016/assets/a%23b.png");
  });

  it("lets a directory without a date prefix fall through", async () => {
    const res = await createTestApp().request("/images/icons/logo.svg", {}, env(), executionCtx());

    expect(res.status).toBe(404);
  });

  it("lets a directory without a known article fall through", async () => {
    const res = await createTestApp().request(
      "/images/2016-09-26-never_published/cover.png",
      {},
      env(),
      executionCtx(),
    );

    expect(res.status).toBe(404);
  });
});
