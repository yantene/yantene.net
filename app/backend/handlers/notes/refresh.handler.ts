import { Hono } from "hono";
import { resolveContentStore } from "./resolve-content-store";
import {
  D1NoteCommandRepository,
  D1NoteQueryRepository,
} from "~/backend/infra/d1/repositories";
import { R2NoteContentCache } from "~/backend/infra/r2/r2-note-content-cache";
import { NotesRefreshService } from "~/backend/services/notes-refresh.service";

/**
 * ノート同期 (refresh) の JSON API ルータ。認証必須 (index.ts で requireSession 配下に
 * マウントする)。Composition Root として具象を生成し NotesRefreshService に注入する。
 *
 * POST /refresh → Artifacts を D1 + R2 に同期し、処理結果サマリを返す。
 */
export function createRefreshRouter(): Hono<{ Bindings: Env }> {
  const router = new Hono<{ Bindings: Env }>();

  router.post("/refresh", async (c) => {
    const service = new NotesRefreshService(
      resolveContentStore(c.env),
      new D1NoteCommandRepository(c.env.D1),
      new D1NoteQueryRepository(c.env.D1),
      new R2NoteContentCache(c.env.R2),
    );
    const result = await service.refresh();
    return c.json(result);
  });

  return router;
}
