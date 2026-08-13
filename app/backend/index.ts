import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import {
  NONCE,
  secureHeaders,
  type SecureHeadersVariables,
} from "hono/secure-headers";
import { createFeedRouter } from "./handlers/feed.handler";
import { createLegacyRedirectRouter } from "./handlers/legacy-redirects.handler";
import { createLinkCardAssetsRouter } from "./handlers/link-cards/assets.handler";
import { createNoteAssetsRouter } from "./handlers/notes/assets.handler";
import { createNoteDetailApiRouter } from "./handlers/notes/detail.handler";
import { createNotesApiRouter } from "./handlers/notes/list-api.handler";
import { createNoteMarkdownRouter } from "./handlers/notes/markdown.handler";
import { createNoteReactionApiRouter } from "./handlers/notes/reaction.handler";
import { createRefreshRouter } from "./handlers/notes/refresh.handler";
import { createSearchApiRouter } from "./handlers/notes/search.handler";
import { createTagsApiRouter } from "./handlers/notes/tags.handler";
import { createOgRouter } from "./handlers/og.handler";
import { createSeoRouter } from "./handlers/seo.handler";
import { createWebmentionRouter } from "./handlers/webmention.handler";
import { createWebmentionAvatarsRouter } from "./handlers/webmentions/avatars.handler";
import type { MiddlewareHandler } from "hono";
import { NoteNotFoundError } from "~/backend/domain/note";
import { conditionalBasicAuth } from "~/backend/middleware/basic-auth";
import { createProblemResponse, notFoundResponse } from "~/lib/problem-details";

type RootBindings = {
  Bindings: Env;
  Variables: SecureHeadersVariables;
};

// hono は SecureHeadersOptions を export していないため、関数のシグネチャから取る。
type SecureHeadersOptions = NonNullable<Parameters<typeof secureHeaders>[0]>;

/** CSP 以外のセキュリティヘッダー。全環境で共通に付ける。 */
const baseSecureHeaderOptions: SecureHeadersOptions = {
  strictTransportSecurity: "max-age=31536000; includeSubDomains; preload",
  xFrameOptions: "DENY",
  referrerPolicy: "strict-origin-when-cross-origin",
  permissionsPolicy: {
    camera: [],
    microphone: [],
    geolocation: [],
  },
};

/**
 * Google Fonts の 2 ホスト。CSS を配る側とフォント本体を配る側で分かれている (ADR 0017)。
 *
 * 名指しした 2 つ以外は届かないままにする。ここで許すのは「この 2 ホストから CSS と
 * フォントを読む」ことだけ。
 */
const GOOGLE_FONTS_CSS_ORIGIN = "https://fonts.googleapis.com";
const GOOGLE_FONTS_FILE_ORIGIN = "https://fonts.gstatic.com";

/**
 * staging / production 用の CSP。
 *
 * `script-src` は nonce 方式のまま厳格に保つ (ADR 0007)。`style-src` にだけ
 * `'unsafe-inline'` を置いてある (ADR 0019、理由は下記)。**両者を混同しないこと。**
 */
const secureHeadersWithCsp: MiddlewareHandler<RootBindings> = secureHeaders({
  ...baseSecureHeaderOptions,
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: [NONCE, "'self'"],
    /*
     * Google Fonts の @font-face は CSS として配られるので、読み込み先が要る。
     *
     * `'unsafe-inline'` は数式のため (ADR 0019)。Temml は表組みの桁や数式番号の位置を
     * inline style で渡してくる。**script-src は厳格なままにしてある。** 本文から任意の
     * style を差し込めないよう、sanitize の allowlist では MathML の要素にだけ `style` を
     * 許している (components/mdast/mathml.ts)。
     */
    styleSrc: ["'self'", "'unsafe-inline'", GOOGLE_FONTS_CSS_ORIGIN],
    imgSrc: ["'self'", "data:"],
    connectSrc: ["'self'"],
    fontSrc: ["'self'", GOOGLE_FONTS_FILE_ORIGIN],
    // 本文に埋め込む動画の読み込み先。ここに無いホストの iframe はブラウザが止める。
    // 描画側 (mdast-renderer) が src をこのホストへ正規化しているので、両者は対で動く。
    frameSrc: ["https://www.youtube-nocookie.com"],
    frameAncestors: ["'none'"],
  },
});

/** development 用。CSP のみ外す。 */
const secureHeadersWithoutCsp: MiddlewareHandler<RootBindings> = secureHeaders(
  baseSecureHeaderOptions,
);

/**
 * CSP は development でのみ外す (ADR 0007)。
 *
 * Vite の dev サーバーは HMR で CSS を inline `<style>` として注入するため、
 * `style-src 'self'` 下では CSS が丸ごと落ちて見た目の確認ができない。
 * development 以外 (想定外の APP_ENV を含む) では必ず CSP を付ける (secure by default)。
 */
const environmentAwareSecureHeaders = createMiddleware<RootBindings>(
  async (c, next) => {
    const middleware =
      c.env.APP_ENV === "development"
        ? secureHeadersWithoutCsp
        : secureHeadersWithCsp;
    await middleware(c, next);
  },
);

/**
 * Hono アプリを組み立てる。ページ描画は React Router に委譲する。
 *
 * Hono が受け持つのは「HTTP レイヤーの横断的関心事」と「ページ以外のエンドポイント」:
 * secure headers / BASIC 認証 / JSON API / フィード・OG 画像・sitemap。
 * それ以外のリクエストは末尾の `app.all("*")` で React Router のリクエストハンドラへ
 * 引き渡す (Composition Root は各ハンドラと loader 側に置く)。
 *
 * @param handler React Router のリクエストハンドラ。CSP nonce を渡して
 *   `<Scripts nonce>` / `<ScrollRestoration nonce>` から参照できるようにする。
 */
export const getApp = (
  handler: (
    request: Request,
    env: Env,
    ctx: ExecutionContext,
    nonce: string,
  ) => Promise<Response>,
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- Hono の戻り値型を明示すると型推論を阻害するため、ここだけ推論に任せる
) => {
  const app = new Hono<RootBindings>();

  app.use("*", environmentAwareSecureHeaders);

  app.use("*", conditionalBasicAuth);

  app.get("/health", (c) => c.json({ status: "ok" }));

  // ノートの公開 JSON API (一覧 / 詳細 / アセット, クローラー対応)。
  app.route("/api/v1/notes", createNotesApiRouter());
  app.route("/api/v1/notes", createNoteDetailApiRouter());
  app.route("/api/v1/notes", createNoteAssetsRouter());
  app.route("/api/v1/notes", createNoteReactionApiRouter());
  app.route("/api/v1/link-cards", createLinkCardAssetsRouter());
  app.route("/api/v1/webmentions", createWebmentionAvatarsRouter());
  app.route("/api/v1/tags", createTagsApiRouter());
  app.route("/api/v1/search", createSearchApiRouter());
  app.route("/og", createOgRouter());
  app.route("/", createFeedRouter());
  app.route("/", createSeoRouter());

  // 旧サイト (Jekyll + GitHub Pages) の URL を現行サイトへ恒久リダイレクトする。
  // 表に無いパスは素通りするので、後続のルーティングには影響しない。
  app.route("/", createLegacyRedirectRouter());

  // ノートの原文 Markdown (`/notes/<slug>.md`)。ページではなくファイルを返すので
  // React Router へ委譲せず Hono で完結させる。`.md` 以外の /notes/* は素通りする。
  app.route("/notes", createNoteMarkdownRouter());

  // ノート同期 (コンテンツ正本 → D1 + R2)。POST /api/v1/refresh。
  // REFRESH_SECRET で保護する運用エンドポイント。
  app.route("/api/v1", createRefreshRouter());

  // Webmention の受け口 (POST /webmention)。ノート詳細ページの
  // <link rel="webmention"> が広告している先。
  app.route("/", createWebmentionRouter());

  // 上記以外はすべて React Router のページルーティングに委ねる。
  app.all("*", async (c) => {
    const nonce = c.get("secureHeadersNonce") ?? "";
    return handler(c.req.raw, c.env, c.executionCtx as ExecutionContext, nonce);
  });

  app.onError((error, _context) => {
    if (error instanceof HTTPException) {
      const response = createProblemResponse(error.status, error.message);
      // 認証チャレンジ (WWW-Authenticate, RFC 7235) を Problem Details に引き継ぐ。
      // これが無いと BASIC 認証の 401 でブラウザが認証ダイアログを出さない。
      const challenge = error.res?.headers.get("WWW-Authenticate");
      if (challenge !== undefined && challenge !== null) {
        response.headers.set("WWW-Authenticate", challenge);
      }
      return response;
    }
    // ドメインエラー → HTTP マッピング (Composition Root の責務)。
    if (error instanceof NoteNotFoundError) {
      return notFoundResponse(error.message);
    }
    console.error(error);
    return createProblemResponse(500, "Internal Server Error");
  });

  return app;
};
