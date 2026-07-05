import { inertia } from "@hono/inertia";
import { Hono } from "hono";
import { createLogoutRouter } from "~/backend/handlers/auth/logout.handler";
import { createMagicLinkRouter } from "~/backend/handlers/auth/magic-link.handler";
import { createNoteDetailPagesRouter } from "~/backend/handlers/notes/detail.handler";
import { createNotesPagesRouter } from "~/backend/handlers/notes/pages.handler";
import {
  type LocaleVariables,
  localeMiddleware,
} from "~/backend/middleware/locale";
import { rootView } from "~/frontend/root-view";

type PagesBindings = {
  Bindings: Env;
  Variables: LocaleVariables;
};

export function createPagesRouter(): Hono<PagesBindings> {
  const router = new Hono<PagesBindings>();

  router.use("*", localeMiddleware);
  router.use(inertia({ rootView }));

  // ホーム (公開・認証不要)。発信のハブとしてノート一覧への導線を持つ。
  router.get("/", (c) => c.render("home", { locale: c.get("locale") }));

  // ログイン UI + magic link + logout。現状ログインは休眠 (将来の有料記事用に温存)。
  router.get("/login", (c) =>
    c.render("login", {
      locale: c.get("locale"),
      error: c.req.query("error") ?? null,
    }),
  );
  router.get("/login/sent", (c) =>
    c.render("login-sent", { locale: c.get("locale") }),
  );
  router.route("/", createMagicLinkRouter());
  router.route("/", createLogoutRouter());

  // ノートの公開ページ (一覧 / 詳細, 認証不要・クローラー対応)。
  router.route("/", createNotesPagesRouter());
  router.route("/", createNoteDetailPagesRouter());

  // 認証必須ページは現状なし。将来 (有料記事等) を追加する際は、ここで
  // requireSessionOrRedirect を挟んでからマウントする。
  return router;
}
