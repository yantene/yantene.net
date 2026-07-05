import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  NONCE,
  secureHeaders,
  type SecureHeadersVariables,
} from "hono/secure-headers";
import { createApiRouter } from "./handlers/api";
import { createNoteAssetsRouter } from "./handlers/notes/assets.handler";
import { createNotesApiRouter } from "./handlers/notes/list-api.handler";
import { createRefreshRouter } from "./handlers/notes/refresh.handler";
import { createPagesRouter } from "./handlers/pages";
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

// ノートの公開 JSON API / アセット API (認証不要・クローラー対応)。requireSession より
// 前にマウントし、ハンドラが応答して短絡することで /api/* の認証ガードを通さない。
app.route("/api/v1/notes", createNotesApiRouter());
app.route("/api/v1/notes", createNoteAssetsRouter());

// 認証必須 JSON API
app.use("/api/*", requireSession);
app.route("/api", createApiRouter());
// ノート同期 (Artifacts → D1 + R2)。認証必須。
app.route("/api", createRefreshRouter());

// Inertia.js ページルート (locale + inertia ミドルウェアは router 内で適用)
app.route("/", createPagesRouter());

app.onError((error, _context) => {
  if (error instanceof HTTPException) {
    return createProblemResponse(error.status, error.message);
  }
  // ドメインエラー → HTTP マッピング (Composition Root の責務)。
  if (error instanceof UserNotFoundError) {
    return notFoundResponse(error.message);
  }
  console.error(error);
  return createProblemResponse(500, "Internal Server Error");
});

export { type HonoApp } from "~/backend/middleware/auth";

export default app;
