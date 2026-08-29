import { Hono } from "hono";
import { contentCacheControlFor } from "~/backend/handlers/notes/content-cache-control";
import { R2WebmentionAvatarCache } from "~/backend/infra/r2/r2-webmention-avatar-cache";
import { notFoundResponse } from "~/lib/problem-details";

/**
 * Webmention の著者アイコンを R2 から配信する公開ルータ。
 *
 * 相手のドメインからは読み込めない (`img-src 'self' data:`) ので、受け取ったときに
 * 写しておいたものをここから配る。id は URL のダイジェストなので、パスから相手の
 * アイコンの在りかは読み取れない。
 *
 * GET /avatars/:id
 */
export function createWebmentionAvatarsRouter(): Hono<{ Bindings: Env }> {
  const router = new Hono<{ Bindings: Env }>();

  // id の形をルーティングで縛る。R2 のキーに素の入力を混ぜないための一段目。
  router.get("/avatars/:id{[0-9a-f]{32}}", async (c) => {
    const avatar = await new R2WebmentionAvatarCache(c.env.R2).get(c.req.param("id"));
    /*
     * 中身の無い写しを「在る」と答えない。
     *
     * 0 バイトの顔が入ってしまったものがある (#322)。**これだけでは読み手の画面は
     * 直らない** (404 でも `<img>` は描けない。代わりを出すのは webmention-list.tsx の
     * 仕事)。ここで落とすのは、空を 200 で配ると経路上の蓄えに空が乗るため。
     */
    if (avatar === undefined || avatar.bytes.byteLength === 0) {
      return notFoundResponse("avatar not found");
    }

    // Uint8Array はランタイムでは有効な body。型上の齟齬だけをキャストで解消する。
    return new Response(avatar.bytes as BodyInit, {
      headers: {
        "Content-Type": avatar.contentType,
        "Cache-Control": contentCacheControlFor(c.env),
      },
    });
  });

  return router;
}
