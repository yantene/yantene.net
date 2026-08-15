import { Hono } from "hono";
import { contentCacheControlFor } from "./notes/content-cache-control";
import type { Context } from "hono";

/**
 * 旧サイトの記事スラグ → 現行サイトのノートスラグ。
 *
 * 現行スラグは旧スラグをそのまま移したものではない。`_` を `-` に置換しただけで一致するのは
 * 27 本中 6 本だけで、残りは付け直してある。つまり変換規則では表せないので明示テーブルで持つ。
 *
 * 仮に規則で表せたとしても採らない。規則で受けると存在しない `/foo_bar.html` にまで恒久
 * リダイレクトを返してしまい、「恒久リダイレクトの行き先が 404」という、ブラウザのキャッシュに
 * 焼き付いて取り消せない状態を作るため。旧サイトは 2017 年で更新が止まっているので、この表が
 * 増えることはない。
 *
 * テストが実装そのものを検証できるよう公開する。
 */
/* eslint-disable no-secrets/no-secrets -- 旧記事のスラグを高エントロピーの秘匿情報と誤検知するため、表だけを囲んで無効化する (秘密は含まない)。 */
export const noteSlugByLegacySlug: ReadonlyMap<string, string> = new Map([
  ["i_bought_arduino", "arduino-one-minute-timer"],
  ["sugoroku_by_c", "sugoroku-in-c"],
  ["one_month_before_the_fe_exam", "one-month-until-fe-exam"],
  ["aichi_breaker", "aichi-breaker"],
  ["passed_fe_exam", "passed-fe-exam"],
  ["first_challenge_of_topcoder", "first-topcoder-practice"],
  ["practice_of_topcoder", "topcoder-practice-after-exams"],
  ["first_challenge_of_srm", "first-topcoder-srm"],
  ["practice_practice", "topcoder-srm153-div2-250"],
  ["combsort", "comb-sort-in-java"],
  ["opencobol_in_ubuntu", "install-opencobol-on-ubuntu"],
  ["clang_for_joi", "back-to-c-for-joi"],
  ["amidakuji", "amidakuji-in-c"],
  ["joi2009_yosen_q4", "joi-2009-qual-q4"],
  ["joi2009_yosen_q5_failed", "joi-2009-qual-q5-failed"],
  ["amidakuji_by_cobol", "amidakuji-in-cobol"],
  ["joi2009_yosen_q5_succeed", "joi-2009-qual-q5-solved"],
  ["passed_ap_exam", "passed-ap-exam"],
  [
    "svt1311aj_linux_brightness_adjustment",
    "vaio-svt1311aj-brightness-on-linux",
  ],
  ["code_thanks_festival_2014", "code-thanks-festival-2014"],
  ["install_arch_linux_on_uefi_machine", "install-arch-linux-on-vaio-pro"],
  ["tut_tani_checker", "tut-credit-checker"],
  ["tut_photographs", "tut-in-photos"],
  ["install_arch_on_kvi-70b", "install-arch-linux-on-kvi-70b"],
  ["hacku_2016", "hacku-2016"],
  ["use_tutvpn_wisely", "tut-vpn-with-ocproxy"],
  ["invitation_to_flared", "invitation-to-flared"],
]);
/* eslint-enable no-secrets/no-secrets */

/** 旧サイトの画像ディレクトリ名 (`2016-09-26-hacku_2016`) から日付を落とす。 */
const legacyImageDirectoryPattern = /^\d{4}-\d{2}-\d{2}-(?<slug>.+)$/u;

/**
 * 恒久移転は 308 で返す。301 と違ってメソッドとボディを保持する。旧サイトは静的配信で
 * GET しか来ないため実利上の差はないが、意味の狭いほう (メソッドを書き換えない) を選ぶ。
 * 一時移転の 307 は「元の URL に戻る可能性がある」を意味するのでここでは使えない。
 */
const PERMANENT_REDIRECT = 308 as const;

function permanentRedirect(
  c: Context<{ Bindings: Env }>,
  to: string,
): Response {
  // ノートの配信と同じ規則に揃える。BASIC 認証が有効な環境 (staging) で共有キャッシュに
  // 載せると、認証の壁を越えて未認証クライアントへ配られてしまうため。
  c.header("Cache-Control", contentCacheControlFor(c.env));
  return c.redirect(to, PERMANENT_REDIRECT);
}

/**
 * Location に載せるパスを組み立てる。Hono のパスパラメータは復号済みなので、区切りの
 * `/` は保ったままセグメント単位で符号化し直す。素通しすると `#` や `?` を含む名前が
 * リダイレクト先の意味を変えてしまう。
 */
function encodePath(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

/**
 * 旧 yantene.net (Jekyll + GitHub Pages) の URL を現行サイトへ恒久リダイレクトする
 * 公開ルータ。認証不要なので index.ts で auth ガードより前にマウントする。
 *
 * 旧サイトの URL は外部のリンク・検索結果・フィード購読に残っており、ドメインを
 * 本アプリへ向けた時点で行き先を失う。
 *
 * - /<legacy-slug>.html                 → /notes/<slug>
 * - /index.html, /profile.html          → / (プロフィールは相当ページが無いため暫定)
 * - /list.html                          → /notes (tag クエリを引き継ぐ)
 * - /atom.xml                           → /feed.xml
 * - /images/<date>-<legacy-slug>/<file> → /api/v1/notes/<slug>/assets/<file>
 *
 * 記事は `/:file{[^/]+[.]html}` のような可変パターンではなく、27 本を静的パスとして
 * 1 本ずつ登録する。ルート直下でカスタム正規表現のパラメータを使うと、Hono の SmartRouter
 * が RegExpRouter を諦めて TrieRouter に落ち、この 27 本のためにアプリ全体のリクエストが
 * 遅いマッチャーを通ることになるため。
 *
 * 移転先にクエリ文字列は持ち込まない。旧サイトの記事 URL にクエリは無く、外から付いて
 * くるのは utm 等のトラッキングだけである。計測用に Cloudflare Web Analytics のビーコンは
 * 置いてあるが (ADR 0021。CSP の connect-src にも cloudflareinsights.com がある)、utm を
 * 読むコードはこのアプリのどこにも無い。旧サイトが実際に使っていた /list.html の tag だけは
 * 引き継ぐ。
 */
export function createLegacyRedirectRouter(): Hono<{ Bindings: Env }> {
  const router = new Hono<{ Bindings: Env }>();

  for (const [legacySlug, slug] of noteSlugByLegacySlug) {
    router.get(`/${legacySlug}.html`, (c) =>
      permanentRedirect(c, `/notes/${slug}`),
    );
  }

  router.get("/index.html", (c) => permanentRedirect(c, "/"));

  // プロフィールは現行サイトに相当ページが無い。行き止まりにはせずトップへ送る。
  router.get("/profile.html", (c) => permanentRedirect(c, "/"));

  router.get("/atom.xml", (c) => permanentRedirect(c, "/feed.xml"));

  // 旧サイトの全記事一覧。タグでの絞り込みはクエリで表しており、タグ名は現行サイトと
  // 同一なのでそのまま引き継ぐ。
  router.get("/list.html", (c) => {
    const tag = c.req.query("tag") ?? "";
    const to =
      tag.length > 0 ? `/notes?tag=${encodeURIComponent(tag)}` : "/notes";
    return permanentRedirect(c, to);
  });

  // 記事に紐付く画像。現行サイトではアセット API が配信する。表に無いディレクトリは
  // 素通りさせ、通常の 404 に委ねる。
  router.get("/images/:directory/:file{.+}", (c, next) => {
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
      `/api/v1/notes/${slug}/assets/${encodePath(c.req.param("file"))}`,
    );
  });

  return router;
}
