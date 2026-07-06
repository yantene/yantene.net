import { inertia } from "@hono/inertia";
import { Hono } from "hono";
import { createLogoutRouter } from "~/backend/handlers/auth/logout.handler";
import { createMagicLinkRouter } from "~/backend/handlers/auth/magic-link.handler";
import { toPublicNote } from "~/backend/handlers/note-view";
import { createNoteDetailPagesRouter } from "~/backend/handlers/notes/detail.handler";
import { createNotesPagesRouter } from "~/backend/handlers/notes/pages.handler";
import { createTagsPagesRouter } from "~/backend/handlers/notes/tags.handler";
import { D1NoteQueryRepository } from "~/backend/infra/d1/repositories";
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

  // ホーム (公開・認証不要)。Hero + 新着ノート 6 件を発信ハブとして表示する。
  router.get("/", async (c) => {
    const query = new D1NoteQueryRepository(c.env.D1);
    const result = await query.list({
      limit: 6,
      offset: 0,
      sortBy: "publishedOn",
      direction: "desc",
    });
    return c.render("home", {
      locale: c.get("locale"),
      notes: result.notes.map((note) => toPublicNote(note)),
    });
  });

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

  // ノートの公開ページ (一覧 / 詳細 / タグ索引, 認証不要・クローラー対応)。
  router.route("/", createNotesPagesRouter());
  router.route("/", createNoteDetailPagesRouter());
  router.route("/", createTagsPagesRouter());

  // 認証必須ページは現状なし。将来 (有料記事等) を追加する際は、ここで
  // requireSessionOrRedirect を挟んでからマウントする。
  return router;
}
