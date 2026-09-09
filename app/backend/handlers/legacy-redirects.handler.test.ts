import { describe, expect, it } from "vitest";
import { noteSlugByLegacySlug } from "./legacy-redirects.handler";
import { slugsRedirectedFromFormerPath } from "~/backend/domain/note";
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
// 旧記事のスラグを高エントロピーの秘匿情報と誤検知するため、表だけを囲んで無効化する (秘密は含まない)。
const noteRedirects: readonly (readonly [string, string])[] = [
  ["/i_bought_arduino.html", "/articles/arduino-one-minute-timer"],
  ["/sugoroku_by_c.html", "/articles/sugoroku-in-c"],
  ["/one_month_before_the_fe_exam.html", "/articles/one-month-until-fe-exam"],
  ["/aichi_breaker.html", "/articles/aichi-breaker"],
  ["/passed_fe_exam.html", "/articles/passed-fe-exam"],
  ["/first_challenge_of_topcoder.html", "/articles/first-topcoder-practice"],
  ["/practice_of_topcoder.html", "/articles/topcoder-practice-after-exams"],
  ["/first_challenge_of_srm.html", "/articles/first-topcoder-srm"],
  ["/practice_practice.html", "/articles/topcoder-srm153-div2-250"],
  ["/combsort.html", "/articles/comb-sort-in-java"],
  ["/opencobol_in_ubuntu.html", "/articles/install-opencobol-on-ubuntu"],
  ["/clang_for_joi.html", "/articles/back-to-c-for-joi"],
  ["/amidakuji.html", "/articles/amidakuji-in-c"],
  ["/joi2009_yosen_q4.html", "/articles/joi-2009-qual-q4"],
  ["/joi2009_yosen_q5_failed.html", "/articles/joi-2009-qual-q5-failed"],
  ["/amidakuji_by_cobol.html", "/articles/amidakuji-in-cobol"],
  ["/joi2009_yosen_q5_succeed.html", "/articles/joi-2009-qual-q5-solved"],
  ["/passed_ap_exam.html", "/articles/passed-ap-exam"],
  ["/svt1311aj_linux_brightness_adjustment.html", "/articles/vaio-svt1311aj-brightness-on-linux"],
  ["/code_thanks_festival_2014.html", "/articles/code-thanks-festival-2014"],
  ["/install_arch_linux_on_uefi_machine.html", "/articles/install-arch-linux-on-vaio-pro"],
  ["/tut_tani_checker.html", "/articles/tut-credit-checker"],
  ["/tut_photographs.html", "/articles/tut-in-photos"],
  ["/install_arch_on_kvi-70b.html", "/articles/install-arch-linux-on-kvi-70b"],
  ["/hacku_2016.html", "/articles/hacku-2016"],
  ["/use_tutvpn_wisely.html", "/articles/tut-vpn-with-ocproxy"],
  ["/invitation_to_flared.html", "/articles/invitation-to-flared"],
];

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
    expect(res.headers.get("location")).toBe("/articles/comb-sort-in-java");
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
    ["/list.html", "/articles"],
  ])("permanently redirects %s to %s", async (from, to) => {
    const res = await createTestApp().request(from, {}, env());

    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe(to);
  });

  /*
   * タグは廃止した (ADR 0029)。効かないクエリを引き継ぐと、308 がブラウザに覚えられて
   * 死んだクエリが残る。旧サイトからのリンクは一覧の先頭へ丸める。
   */
  it("drops the tag of the old article list and lands on the article list", async () => {
    const res = await createTestApp().request("/list.html?tag=%E6%97%A5%E8%A8%98", {}, env());

    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("/articles");
  });
});

/*
 * 記事を `/notes/<slug>` と呼んでいた頃の URL (ADR 0032)。`/notes/` は短文の投稿に譲った
 * ので、恒久リダイレクトを置くのは 2026 年に公開した記事だけに絞ってある。それより前の
 * 記事の `/notes/<slug>` は移さない (外に残ったリンクは諦める)。
 */
describe("article URLs from before the rename", () => {
  /** 転送する記事の対応表。実装の表とは別に、仕様としてここに書き下す。 */
  const movedArticles: readonly (readonly [string, string])[] = [
    ["/notes/back-from-times", "/articles/back-from-times"],
    ["/notes/claude-code-anywhere-with-devpod", "/articles/claude-code-anywhere-with-devpod"],
    ["/notes/the-dryer-shrank-my-kando-jackets", "/articles/the-dryer-shrank-my-kando-jackets"],
  ];

  // 表に余分なエントリが紛れると、短文の投稿に譲った `/notes/` の下に取り消せない
  // 恒久リダイレクトが増える。件数を実装側から取って突き合わせる。
  it("covers the 2026 articles and nothing else", () => {
    expect(movedArticles).toHaveLength(3);
    expect(slugsRedirectedFromFormerPath.size).toBe(movedArticles.length);
  });

  it.each(movedArticles)("permanently redirects %s to %s", async (from, to) => {
    const res = await createTestApp().request(from, {}, env());

    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe(to);
  });

  // 記事ページが `Link: rel="alternate"` で広告していた原文 Markdown の URL (ADR 0009)。
  it.each(movedArticles)("permanently redirects %s.md to %s.md", async (from, to) => {
    const res = await createTestApp().request(`${from}.md`, {}, env());

    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe(`${to}.md`);
  });

  it("caches the redirect under the same rule as note content", async () => {
    const res = await createTestApp().request("/notes/back-from-times", {}, env());

    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
  });

  // ページのルータは末尾のスラッシュ付きでも同じ記事に当てていた。
  it("accepts a trailing slash", async () => {
    const res = await createTestApp().request("/notes/back-from-times/", {}, env());

    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("/articles/back-from-times");
  });

  /*
   * 改名前に開いたままのページのリアクションのフォーム (JS 無しの `<Form method="post">`)
   * は旧 URL へ POST する。308 はメソッドと本文を保つので、移転先の action がそのまま受ける。
   */
  it("carries a POST over to the new URL", async () => {
    const res = await createTestApp().request(
      "/notes/back-from-times",
      { method: "POST", body: new URLSearchParams({ emoji: "❤️" }) },
      env(),
    );

    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("/articles/back-from-times");
  });

  /*
   * 2025 年以前の記事は移さない。素通りした先はページ描画で、`/notes/<slug>` の
   * ルートはもう無いので 404 になる。恒久リダイレクトの行き先が無い状態を作らないよう、
   * 移していない記事に 308 を返さないことを固定する。
   */
  it("lets an article from before 2026 fall through", async () => {
    const res = await createTestApp().request("/notes/hacku-2016", {}, env(), executionCtx());

    expect(res.status).toBe(404);
  });

  it("lets an unknown slug fall through", async () => {
    const res = await createTestApp().request("/notes/never-published", {}, env(), executionCtx());

    expect(res.status).toBe(404);
  });

  /*
   * 一覧は 307。`/notes` は短文の投稿の一覧として戻ってくる予定 (#412) なので、
   * ブラウザに覚えられる 308 は置けない。
   */
  it("temporarily redirects the old article list to /articles", async () => {
    const res = await createTestApp().request("/notes", {}, env());

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("/articles");
  });

  // `?q=` や `?page=` は改名の直前までこのアプリ自身が出していた効くクエリ。
  it("keeps the query of the old article list", async () => {
    const res = await createTestApp().request("/notes?q=devpod&page=2", {}, env());

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("/articles?q=devpod&page=2");
  });

  // 覚えさせない。max-age を付けると 307 でもその間はキャッシュから答えられる。
  it("does not let the temporary redirect be cached", async () => {
    const res = await createTestApp().request("/notes", {}, env());

    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("keeps the whole app on the faster router", async () => {
    const app = createTestApp();
    await app.request("/notes/back-from-times", {}, env());

    expect(app.router.name).toBe("SmartRouter + RegExpRouter");
  });
});

describe("legacy image URLs", () => {
  it("redirects an article image to the asset API", async () => {
    const res = await createTestApp().request(
      "/images/2016-09-26-hacku_2016/scream2.png",
      {},
      env(),
    );

    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("/api/v1/articles/hacku-2016/assets/scream2.png");
  });

  /*
   * パスパラメータは復号済みで届く。素通しすると `#` 以降が fragment に化けて
   * 別のリソースを指し、その 404 がキャッシュされてしまう。
   */
  it("re-encodes characters that would change the target", async () => {
    const res = await createTestApp().request("/images/2016-09-26-hacku_2016/a%23b.png", {}, env());

    expect(res.headers.get("location")).toBe("/api/v1/articles/hacku-2016/assets/a%23b.png");
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
