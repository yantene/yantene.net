import { Hono } from "hono";
import { contentCacheControlFor } from "./articles/content-cache-control";
import type { Context } from "hono";
import { assetPrefixOf } from "~/backend/services/article-asset-url";
import {
  articlePath,
  FORMER_ARTICLE_PATH_PREFIX,
  slugsRedirectedFromFormerPath,
} from "~/backend/domain/article";

/**
 * 旧サイトの記事スラグ → 現行サイトの記事のスラグ。
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
// 旧記事のスラグを高エントロピーの秘匿情報と誤検知するため、表だけを囲んで無効化する (秘密は含まない)。
export const articleSlugByLegacySlug: ReadonlyMap<string, string> = new Map([
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
  ["svt1311aj_linux_brightness_adjustment", "vaio-svt1311aj-brightness-on-linux"],
  ["code_thanks_festival_2014", "code-thanks-festival-2014"],
  ["install_arch_linux_on_uefi_machine", "install-arch-linux-on-vaio-pro"],
  ["tut_tani_checker", "tut-credit-checker"],
  ["tut_photographs", "tut-in-photos"],
  ["install_arch_on_kvi-70b", "install-arch-linux-on-kvi-70b"],
  ["hacku_2016", "hacku-2016"],
  ["use_tutvpn_wisely", "tut-vpn-with-ocproxy"],
  ["invitation_to_flared", "invitation-to-flared"],
]);

/** 旧サイトの画像ディレクトリ名 (`2016-09-26-hacku_2016`) から日付を落とす。 */
const legacyImageDirectoryPattern = /^\d{4}-\d{2}-\d{2}-(?<slug>.+)$/u;

/**
 * 恒久移転は 308 で返す。301 と違ってメソッドとボディを保持する。旧サイトは静的配信で
 * GET しか来ないため実利上の差はないが、意味の狭いほう (メソッドを書き換えない) を選ぶ。
 * 一時移転の 307 は「元の URL に戻る可能性がある」を意味するので、戻らないものには使えない。
 */
const PERMANENT_REDIRECT = 308 as const;

function permanentRedirect(c: Context<{ Bindings: Env }>, to: string): Response {
  // 記事の配信と同じ規則に揃える。BASIC 認証が有効な環境 (staging) で共有キャッシュに
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
 * 過去の URL を現行の URL へリダイレクトするルータ。index.ts で BASIC 認証の後ろに
 * マウントするので、staging では認証を通した相手にだけ答える (どの URL が在るかを
 * 外に教えない)。過去の URL は 2 世代ある。
 *
 * **旧 yantene.net (Jekyll + GitHub Pages)。** 外部のリンク・検索結果・フィード購読に
 * 残っており、ドメインを本アプリへ向けた時点で行き先を失った。
 *
 * - /<legacy-slug>.html                 → /articles/<slug>
 * - /index.html, /profile.html          → / (プロフィールは相当ページが無いため暫定)
 * - /list.html                          → /articles
 * - /atom.xml                           → /feed.xml
 * - /images/<date>-<legacy-slug>/<file> → /api/v1/articles/<slug>/assets/<file>
 *
 * **本アプリで記事を `/notes/<slug>` と呼んでいた頃 (ADR 0032)。** `/notes/` は短文の
 * 投稿に譲ったので、記事は `/articles/` へ移った。
 *
 * - /notes/<slug>, /notes/<slug>.md     → /articles/<slug>, /articles/<slug>.md
 *   (domain/article/article-path.ts の表にある記事だけ。表に無い `/notes/<slug>` は移さない)
 *
 * **一覧の `/notes` はここには無い。** 記事一覧へ 307 で送っていたが、あの URL は短文の
 * 投稿の一覧として戻ってくる場所で (ADR 0032 がそのために 308 を避けていた)、いまは
 * ページのルートが持っている (#412 の中身が入るまでは「準備中」の一枚)。ここに残すと、
 * Hono がページ委譲より先に応えるので、直に開いたときだけ記事一覧へ飛ぶ。
 *
 * どちらの世代も、記事は `/:file{[^/]+[.]html}` のような可変パターンではなく静的パスとして
 * 1 本ずつ登録する。ルート直下でカスタム正規表現のパラメータを使うと、Hono の SmartRouter
 * が RegExpRouter を諦めて TrieRouter に落ち、この数十本のためにアプリ全体のリクエストが
 * 遅いマッチャーを通ることになるため。
 *
 * 移転先にクエリ文字列は持ち込まない。過去の記事 URL にクエリは無く、外から付いて
 * くるのは utm 等のトラッキングだけである。計測用に Cloudflare Web Analytics のビーコンは
 * 置いてあるが (ADR 0021。CSP の connect-src にも cloudflareinsights.com がある)、utm を
 * 読むコードはこのアプリのどこにも無い。
 */
export function createLegacyRedirectRouter(): Hono<{ Bindings: Env }> {
  const router = new Hono<{ Bindings: Env }>();

  for (const [legacySlug, slug] of articleSlugByLegacySlug) {
    // 2 世代を跨ぐ記事でも、旧サイトからの転送は現行の URL へ直に送る (2 段にしない)。
    router.get(`/${legacySlug}.html`, (c) => permanentRedirect(c, articlePath(slug)));
  }

  router.get("/index.html", (c) => permanentRedirect(c, "/"));

  // プロフィールは現行サイトに相当ページが無い。行き止まりにはせずトップへ送る。
  router.get("/profile.html", (c) => permanentRedirect(c, "/"));

  router.get("/atom.xml", (c) => permanentRedirect(c, "/feed.xml"));

  /*
   * 旧サイトの全記事一覧。タグは廃止したので (ADR 0029)、`?tag=` は捨てて一覧の先頭へ
   * 送る。効かないクエリを引き継ぐと、308 がブラウザに覚えられて死んだクエリが残る。
   */
  router.get("/list.html", (c) => permanentRedirect(c, "/articles"));

  // 記事に紐付く画像。現行サイトではアセット API が配信する。表に無いディレクトリは
  // 素通りさせ、通常の 404 に委ねる。
  router.get("/images/:directory/:file{.+}", (c, next) => {
    const legacySlug = legacyImageDirectoryPattern.exec(c.req.param("directory"))?.groups?.slug;
    const slug = legacySlug === undefined ? undefined : articleSlugByLegacySlug.get(legacySlug);
    if (slug === undefined) return next();

    return permanentRedirect(c, `${assetPrefixOf(slug)}${encodePath(c.req.param("file"))}`);
  });

  for (const slug of slugsRedirectedFromFormerPath) {
    const from = `${FORMER_ARTICLE_PATH_PREFIX}${slug}`;
    /*
     * 末尾のスラッシュ付きも受ける。ページのルータは付いていても同じ記事に当てていたので、
     * その形で外に残ったリンクもある。POST も受けるのは、改名前に開いたままのページの
     * リアクションのフォーム (JS 無しの `<Form method="post">`) が旧 URL へ送るため。
     * 308 はメソッドと本文を保つので、移転先の action がそのまま受ける。
     */
    router.on(["GET", "POST"], [from, `${from}/`], (c) => permanentRedirect(c, articlePath(slug)));
    // 記事ページが `Link: rel="alternate"` で広告していた原文 Markdown の URL (ADR 0009)。
    router.get(`${from}.md`, (c) => permanentRedirect(c, `${articlePath(slug)}.md`));
  }

  return router;
}
