import { inertia } from "@hono/inertia";
import { Hono } from "hono";
import { toPublicUser } from "./user-view";
import { entityId } from "~/backend/domain/shared";
import { createLogoutRouter } from "~/backend/handlers/auth/logout.handler";
import { createMagicLinkRouter } from "~/backend/handlers/auth/magic-link.handler";
import { D1UserQueryRepository } from "~/backend/infra/d1/repositories";
import { requireSessionOrRedirect } from "~/backend/middleware/auth";
import {
  type LocaleVariables,
  localeMiddleware,
} from "~/backend/middleware/locale";
import { rootView } from "~/frontend/root-view";

type PagesBindings = {
  Bindings: Env;
  Variables: LocaleVariables & { userId: string };
};

export function createPagesRouter(): Hono<PagesBindings> {
  const router = new Hono<PagesBindings>();

  router.use("*", localeMiddleware);
  router.use(inertia({ rootView }));

  // 認証不要 (login UI + magic link strategy + logout)
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

  // 以降は認証必須
  router.use("*", requireSessionOrRedirect);

  router.get("/", async (c) => {
    const query = new D1UserQueryRepository(c.env.D1);
    const user = await query.findById(entityId<"User">(c.get("userId")));
    // session が指す User が消えている (stale session) ときは /login へ戻す。
    if (user === undefined) return c.redirect("/login", 303);
    return c.render("home", {
      locale: c.get("locale"),
      user: toPublicUser(user),
    });
  });

  return router;
}
