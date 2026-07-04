import { Hono } from "hono";
import { toPublicUser } from "./user-view";
import type { HonoApp } from "~/backend/middleware/auth";
import { entityId } from "~/backend/domain/shared";
import { UserNotFoundError } from "~/backend/domain/user";
import { D1UserQueryRepository } from "~/backend/infra/d1/repositories";

/**
 * 認証必須の JSON API ルータ。requireSession は app/backend/index.ts 側で
 * "/api/*" にまとめて適用される前提。
 */
export function createApiRouter(): Hono<HonoApp> {
  const router = new Hono<HonoApp>();

  router.get("/me", async (c) => {
    const userId = entityId<"User">(c.get("userId"));
    const query = new D1UserQueryRepository(c.env.D1);
    const user = await query.findById(userId);
    // session は有効なのに User レコードが無い = 認証済みユーザーの不在。
    // typed なドメインエラーとして投げ、HTTP マッピングは onError に委ねる。
    if (user === undefined) throw new UserNotFoundError(userId);
    return c.json(toPublicUser(user));
  });

  return router;
}
