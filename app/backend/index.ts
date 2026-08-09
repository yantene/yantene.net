import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import {
  NONCE,
  secureHeaders,
  type SecureHeadersVariables,
} from "hono/secure-headers";
import { createApiRouter } from "./handlers/api";
import { createLogoutRouter } from "./handlers/auth/logout.handler";
import { createMagicLinkRouter } from "./handlers/auth/magic-link.handler";
import { createFeedRouter } from "./handlers/feed.handler";
import { createNoteAssetsRouter } from "./handlers/notes/assets.handler";
import { createNoteDetailApiRouter } from "./handlers/notes/detail.handler";
import { createNotesApiRouter } from "./handlers/notes/list-api.handler";
import { createRefreshRouter } from "./handlers/notes/refresh.handler";
import { createSearchApiRouter } from "./handlers/notes/search.handler";
import { createTagsApiRouter } from "./handlers/notes/tags.handler";
import { createOgRouter } from "./handlers/og.handler";
import { createSeoRouter } from "./handlers/seo.handler";
import type { MiddlewareHandler } from "hono";
import { NoteNotFoundError } from "~/backend/domain/note";
import { UserNotFoundError } from "~/backend/domain/user";
import { requireSession } from "~/backend/middleware/auth";
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

/** staging / production 用。'unsafe-inline' を許可しない厳格な CSP (ADR 0009)。 */
const secureHeadersWithCsp: MiddlewareHandler<RootBindings> = secureHeaders({
  ...baseSecureHeaderOptions,
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: [NONCE, "'self'"],
    styleSrc: ["'self'"],
    imgSrc: ["'self'", "data:"],
    connectSrc: ["'self'"],
    fontSrc: ["'self'"],
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
 * CSP は development でのみ外す (ADR 0011)。
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
 * secure headers / BASIC 認証 / JSON API / フィード・OG 画像・sitemap / 認証フロー。
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

  // public health endpoint (auth 不要)
  app.get("/health", (c) => c.json({ status: "ok" }));

  // ノートの公開 JSON API (一覧 / 詳細 / アセット, 認証不要・クローラー対応)。
  // requireSession より前にマウントし、ハンドラが応答して短絡することで /api/* の
  // 認証ガードを通さない。
  app.route("/api/v1/notes", createNotesApiRouter());
  app.route("/api/v1/notes", createNoteDetailApiRouter());
  app.route("/api/v1/notes", createNoteAssetsRouter());
  app.route("/api/v1/tags", createTagsApiRouter());
  app.route("/api/v1/search", createSearchApiRouter());
  app.route("/og", createOgRouter());
  app.route("/", createFeedRouter());
  app.route("/", createSeoRouter());

  // ノート同期 (コンテンツ正本 → D1 + R2)。POST /api/v1/refresh。
  // session ではなく REFRESH_SECRET で保護する運用エンドポイントなので、requireSession
  // より前にマウントして認証ガードを通さない。
  app.route("/api/v1", createRefreshRouter());

  // 認証必須 JSON API
  app.use("/api/*", requireSession);
  app.route("/api", createApiRouter());

  // 認証フロー (フォーム POST / メールのコールバック)。ページ描画を伴わず
  // リダイレクトのみを返すため、React Router ではなく Hono 側に置く。
  app.route("/", createMagicLinkRouter());
  app.route("/", createLogoutRouter());

  /*
   * かつてタグの一覧を出していた場所。いまはノート一覧が検索とタグの索引を兼ねるので、
   * そちらへ恒久的に送る (外からのリンクや検索結果に残っているため、消さずに畳む)。
   */
  app.get("/tags", (c) => c.redirect("/notes", 301));

  /*
   * かつて検索だけを担っていた場所。ノート一覧が検索の入口と結果を兼ねるようになったので
   * そちらへ送る。外から貼られた検索 URL がそのまま働くよう、検索語は引き継ぐ。
   */
  app.get("/search", (c) => {
    const query = c.req.query("q") ?? "";
    const to =
      query.length > 0 ? `/notes?q=${encodeURIComponent(query)}` : "/notes";
    return c.redirect(to, 301);
  });

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
    if (
      error instanceof UserNotFoundError ||
      error instanceof NoteNotFoundError
    ) {
      return notFoundResponse(error.message);
    }
    console.error(error);
    return createProblemResponse(500, "Internal Server Error");
  });

  return app;
};

export { type HonoApp } from "~/backend/middleware/auth";
