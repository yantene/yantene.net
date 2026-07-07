import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  NONCE,
  secureHeaders,
  type SecureHeadersVariables,
} from "hono/secure-headers";
import { createApiRouter } from "./handlers/api";
import { createFeedRouter } from "./handlers/feed.handler";
import { createNoteAssetsRouter } from "./handlers/notes/assets.handler";
import { createNoteDetailApiRouter } from "./handlers/notes/detail.handler";
import { createNotesApiRouter } from "./handlers/notes/list-api.handler";
import { createRefreshRouter } from "./handlers/notes/refresh.handler";
import { createSearchApiRouter } from "./handlers/notes/search.handler";
import { createTagsApiRouter } from "./handlers/notes/tags.handler";
import { createOgRouter } from "./handlers/og.handler";
import { createPagesRouter } from "./handlers/pages";
import { createSeoRouter } from "./handlers/seo.handler";
import { NoteNotFoundError } from "~/backend/domain/note";
import { UserNotFoundError } from "~/backend/domain/user";
import { requireSession } from "~/backend/middleware/auth";
import { conditionalBasicAuth } from "~/backend/middleware/basic-auth";
import { createProblemResponse, notFoundResponse } from "~/lib/problem-details";

type RootBindings = {
  Bindings: Env;
  Variables: SecureHeadersVariables;
};

const app = new Hono<RootBindings>();

app.use(
  "*",
  secureHeaders({
    strictTransportSecurity: "max-age=31536000; includeSubDomains; preload",
    xFrameOptions: "DENY",
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: [NONCE, "'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      frameAncestors: ["'none'"],
    },
    referrerPolicy: "strict-origin-when-cross-origin",
    permissionsPolicy: {
      camera: [],
      microphone: [],
      geolocation: [],
    },
  }),
);

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

// Inertia.js ページルート (locale + inertia ミドルウェアは router 内で適用)
app.route("/", createPagesRouter());

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

export { type HonoApp } from "~/backend/middleware/auth";

export default app;
