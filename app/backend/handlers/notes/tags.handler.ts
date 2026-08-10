import { Hono } from "hono";
import { D1NoteQueryRepository } from "~/backend/infra/d1/repositories";

export interface TagCount {
  readonly tag: string;
  readonly count: number;
}

/**
 * タグ索引ページのデータを読む (Composition Root)。認証不要。
 * 全タグと各記事数を返す。
 */
export async function loadTagsPage(env: Env): Promise<readonly TagCount[]> {
  return new D1NoteQueryRepository(env.D1).listTags();
}

/**
 * タグ索引の公開 JSON API ルータ (クローラー対応)。
 * `/api/v1/tags` にマウントする。
 * GET / → 全タグと各記事数。
 */
export function createTagsApiRouter(): Hono<{ Bindings: Env }> {
  const router = new Hono<{ Bindings: Env }>();

  router.get("/", async (c) => {
    const query = new D1NoteQueryRepository(c.env.D1);
    const tags = await query.listTags();
    return c.json({ tags });
  });

  return router;
}
