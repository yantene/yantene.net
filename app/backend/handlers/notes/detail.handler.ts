import { Hono } from "hono";
import { toNoteDetail } from "./note-detail-view";
import type { NoteDetail } from "./note-detail-view";
import type { LocaleVariables } from "~/backend/middleware/locale";
import {
  InvalidNoteSlugError,
  NoteNotFoundError,
  NoteSlug,
} from "~/backend/domain/note";
import { D1NoteQueryRepository } from "~/backend/infra/d1/repositories";
import { R2NoteContentCache } from "~/backend/infra/r2/r2-note-content-cache";

/**
 * slug からノート詳細 (メタデータ + キャッシュ済み MDAST) を読む。
 * D1 にメタデータが無い、または R2 に MDAST が無ければ undefined。
 */
async function loadNoteDetail(
  env: Env,
  slug: NoteSlug,
): Promise<NoteDetail | undefined> {
  const note = await new D1NoteQueryRepository(env.D1).findBySlug(slug);
  if (note === undefined) return undefined;
  const mdast = await new R2NoteContentCache(env.R2).getMdast(slug);
  if (mdast === undefined) return undefined;
  return toNoteDetail(note, mdast);
}

function parseSlug(raw: string): NoteSlug | undefined {
  try {
    return NoteSlug.create(raw);
  } catch (error) {
    if (error instanceof InvalidNoteSlugError) return undefined;
    throw error;
  }
}

/**
 * ノート詳細の公開 JSON API ルータ。認証不要。
 * GET /:slug → メタデータ + MDAST。存在しなければ NoteNotFoundError (→ 404)。
 */
export function createNoteDetailApiRouter(): Hono<{ Bindings: Env }> {
  const router = new Hono<{ Bindings: Env }>();

  router.get("/:slug", async (c) => {
    const slugParam = c.req.param("slug");
    const slug = parseSlug(slugParam);
    const detail =
      slug === undefined ? undefined : await loadNoteDetail(c.env, slug);
    if (detail === undefined) throw new NoteNotFoundError(slugParam);
    return c.json(detail);
  });

  return router;
}

/**
 * ノート詳細の公開ページルータ (Inertia)。認証不要。createPagesRouter の
 * locale + inertia ミドルウェア配下・auth ガードより前にマウントする。
 * 存在しない slug は 404 ステータスで not-found 状態のページを描画する。
 */
export function createNoteDetailPagesRouter(): Hono<{
  Bindings: Env;
  Variables: LocaleVariables;
}> {
  const router = new Hono<{ Bindings: Env; Variables: LocaleVariables }>();

  router.get("/notes/:slug", async (c) => {
    const slug = parseSlug(c.req.param("slug"));
    const detail =
      slug === undefined ? undefined : await loadNoteDetail(c.env, slug);

    if (detail === undefined) {
      c.status(404);
      return c.render("notes/show", {
        locale: c.get("locale"),
        note: null,
        mdast: null,
      });
    }

    return c.render("notes/show", {
      locale: c.get("locale"),
      note: detail.note,
      mdast: detail.mdast,
    });
  });

  return router;
}
