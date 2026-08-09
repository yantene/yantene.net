/* eslint-disable no-secrets/no-secrets -- 旧サイトの記事スラグを高エントロピーの秘匿情報と誤検知するため無効化 (秘密は含まない)。 */
import { Hono } from "hono";
import type { Context } from "hono";

/**
 * 旧サイトの記事スラグ → 現行サイトのノートスラグ。
 *
 * 旧スラグの `_` を `-` に置換すると現行スラグに一致する (27 本すべてで確認済み) が、
 * 変換規則ではなく明示テーブルとして持つ。規則で受けると存在しない `/foo_bar.html` にまで
 * 恒久リダイレクトを返してしまい、「恒久リダイレクトの行き先が 404」という、ブラウザの
 * キャッシュに焼き付いて取り消せない状態を作るため。旧サイトは 2017 年で更新が止まって
 * いるので、この表が増えることはない。
 */
const noteSlugByLegacySlug: ReadonlyMap<string, string> = new Map([
  ["i_bought_arduino", "i-bought-arduino"],
  ["sugoroku_by_c", "sugoroku-by-c"],
  ["one_month_before_the_fe_exam", "one-month-before-the-fe-exam"],
  ["aichi_breaker", "aichi-breaker"],
  ["passed_fe_exam", "passed-fe-exam"],
  ["first_challenge_of_topcoder", "first-challenge-of-topcoder"],
  ["practice_of_topcoder", "practice-of-topcoder"],
  ["first_challenge_of_srm", "first-challenge-of-srm"],
  ["practice_practice", "practice-practice"],
  ["combsort", "combsort"],
  ["opencobol_in_ubuntu", "opencobol-in-ubuntu"],
  ["clang_for_joi", "clang-for-joi"],
  ["amidakuji", "amidakuji"],
  ["joi2009_yosen_q4", "joi2009-yosen-q4"],
  ["joi2009_yosen_q5_failed", "joi2009-yosen-q5-failed"],
  ["amidakuji_by_cobol", "amidakuji-by-cobol"],
  ["joi2009_yosen_q5_succeed", "joi2009-yosen-q5-succeed"],
  ["passed_ap_exam", "passed-ap-exam"],
  [
    "svt1311aj_linux_brightness_adjustment",
    "svt1311aj-linux-brightness-adjustment",
  ],
  ["code_thanks_festival_2014", "code-thanks-festival-2014"],
  ["install_arch_linux_on_uefi_machine", "install-arch-linux-on-uefi-machine"],
  ["tut_tani_checker", "tut-tani-checker"],
  ["tut_photographs", "tut-photographs"],
  ["install_arch_on_kvi-70b", "install-arch-on-kvi-70b"],
  ["hacku_2016", "hacku-2016"],
  ["use_tutvpn_wisely", "use-tutvpn-wisely"],
  ["invitation_to_flared", "invitation-to-flared"],
]);

/** 旧サイトの画像ディレクトリ名 (`2016-09-26-hacku_2016`) から日付を落とす。 */
const legacyImageDirectoryPattern = /^\d{4}-\d{2}-\d{2}-(?<slug>.+)$/u;

const HTML_SUFFIX = ".html";

/**
 * 移転先はもう動かないので長くキャッシュさせたいが、取り違えに気づいたときに
 * 巻き取れる猶予も要る。1 日を落としどころにする。
 */
const REDIRECT_CACHE_CONTROL = "public, max-age=86400";

/**
 * 恒久移転は 308 で返す。301 と違ってメソッドとボディを保持する。旧サイトは静的配信で
 * GET しか来ないため実利上の差はないが、意味の狭いほう (メソッドを書き換えない) を選ぶ。
 * 一時移転の 307 は「元の URL に戻る可能性がある」を意味するのでここでは使えない。
 */
const PERMANENT_REDIRECT = 308 as const;

function permanentRedirect(c: Context, to: string): Response {
  c.header("Cache-Control", REDIRECT_CACHE_CONTROL);
  return c.redirect(to, PERMANENT_REDIRECT);
}

/**
 * 移転の確認は HEAD で来ることがある (クローラや `curl -I`)。GET だけで受けると
 * HEAD がページルーティングに落ちて 404 になり、「移転していない」と読めてしまう。
 */
const redirectMethods = ["GET", "HEAD"];

/**
 * 旧 yantene.net (Jekyll + GitHub Pages) の URL を現行サイトへ恒久リダイレクトする
 * 公開ルータ。認証不要なので index.ts で auth ガードより前にマウントする。
 *
 * 旧サイトの URL は外部のリンク・検索結果・フィード購読に残っており、ドメインを
 * 本アプリへ向けた時点で行き先を失う。表に無いパスは素通りさせ、通常の 404 に委ねる。
 *
 * - /<legacy-slug>.html                 → /notes/<slug>
 * - /index.html, /profile.html          → / (プロフィールは相当ページが無いため暫定)
 * - /list.html                          → /notes (tag クエリを引き継ぐ)
 * - /atom.xml                           → /feed.xml
 * - /images/<date>-<legacy-slug>/<file> → /api/v1/notes/<slug>/assets/<file>
 */
export function createLegacyRedirectRouter(): Hono<{ Bindings: Env }> {
  const router = new Hono<{ Bindings: Env }>();

  router.on(redirectMethods, "/index.html", (c) => permanentRedirect(c, "/"));

  // プロフィールは現行サイトに相当ページが無い。行き止まりにはせずトップへ送る。
  router.on(redirectMethods, "/profile.html", (c) => permanentRedirect(c, "/"));

  router.on(redirectMethods, "/atom.xml", (c) =>
    permanentRedirect(c, "/feed.xml"),
  );

  // 旧サイトの全記事一覧。タグでの絞り込みはクエリで表しており、タグ名は現行サイトと
  // 同一なのでそのまま引き継ぐ。
  router.on(redirectMethods, "/list.html", (c) => {
    const tag = c.req.query("tag") ?? "";
    const to =
      tag.length > 0 ? `/notes?tag=${encodeURIComponent(tag)}` : "/notes";
    return permanentRedirect(c, to);
  });

  // `.` は文字クラスで書く (markdown.handler と同じ理由: エスケープすると Hono が
  // パスからパラメータ名を型推論できなくなる)。
  router.on(redirectMethods, "/:file{[^/]+[.]html}", async (c, next) => {
    const file = c.req.param("file");
    const slug = noteSlugByLegacySlug.get(file.slice(0, -HTML_SUFFIX.length));
    if (slug === undefined) return next();

    return permanentRedirect(c, `/notes/${slug}`);
  });

  // 記事に紐付く画像。現行サイトではアセット API が配信する。
  router.on(
    redirectMethods,
    "/images/:directory/:file{.+}",
    async (c, next) => {
      const legacySlug = legacyImageDirectoryPattern.exec(
        c.req.param("directory"),
      )?.groups?.slug;
      const slug =
        legacySlug === undefined
          ? undefined
          : noteSlugByLegacySlug.get(legacySlug);
      if (slug === undefined) return next();

      return permanentRedirect(
        c,
        `/api/v1/notes/${slug}/assets/${c.req.param("file")}`,
      );
    },
  );

  return router;
}
