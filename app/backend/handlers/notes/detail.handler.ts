import { Hono } from "hono";
import { toNoteDetail } from "./note-detail-view";
import type { NoteDetail } from "./note-detail-view";
import type { LocaleVariables } from "~/backend/middleware/locale";
import {
  InvalidNoteSlugError,
  NoteNotFoundError,
  NoteSlug,
  NoteTag,
} from "~/backend/domain/note";
import { toPublicNote } from "~/backend/handlers/note-view";
import { D1NoteQueryRepository } from "~/backend/infra/d1/repositories";
import { R2NoteContentCache } from "~/backend/infra/r2/r2-note-content-cache";

/** 記事末に出す関連記事の最大件数。 */
const RELATED_LIMIT = 6;

/**
 * slug からノート詳細 (メタデータ + キャッシュ済み MDAST) を読む。
 *
 * - D1 にメタデータが無い = そもそも存在しないノート → undefined (呼び出し側で 404)。
 * - D1 に在るのに R2 の MDAST が無い = キャッシュ不整合。静かに 404 で隠さず throw する
 *   (fail-loud)。公開済みの記事が消えて見えるより、不整合を表面化させる。
 *
 * D1 と R2 は共に slug 依存で互いに独立なので並行に読む。
 */
async function loadNoteDetail(
  env: Env,
  slug: NoteSlug,
): Promise<NoteDetail | undefined> {
  const [note, mdast] = await Promise.all([
    new D1NoteQueryRepository(env.D1).findBySlug(slug),
    new R2NoteContentCache(env.R2).getMdast(slug),
  ]);
  if (note === undefined) return undefined;
  if (mdast === undefined) {
    throw new Error(
      `MDAST cache is missing for an indexed note: ${slug.toString()}`,
    );
  }
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

/** slug パラメータを解決して詳細をロードする共通処理 (API / ページで共有)。 */
async function resolveDetail(
  env: Env,
  slugParam: string,
): Promise<NoteDetail | undefined> {
  const slug = parseSlug(slugParam);
  return slug === undefined ? undefined : loadNoteDetail(env, slug);
}

/**
 * ノート詳細の公開 JSON API ルータ。認証不要。
 * GET /:slug → メタデータ + MDAST。存在しなければ NoteNotFoundError (→ 404)。
 */
export function createNoteDetailApiRouter(): Hono<{ Bindings: Env }> {
  const router = new Hono<{ Bindings: Env }>();

  router.get("/:slug", async (c) => {
    const slugParam = c.req.param("slug");
    const detail = await resolveDetail(c.env, slugParam);
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
    const detail = await resolveDetail(c.env, c.req.param("slug"));

    if (detail === undefined) {
      c.status(404);
      return c.render("notes/show", {
        locale: c.get("locale"),
        note: null,
        mdast: null,
      });
    }

    const origin = new URL(c.req.url).origin;
    const relatedTags = detail.note.tags.map((tag) => NoteTag.create(tag));
    const query = new D1NoteQueryRepository(c.env.D1);
    const related = await query.findRelated(
      NoteSlug.create(detail.note.slug),
      relatedTags,
      RELATED_LIMIT,
    );
    return c.render("notes/show", {
      locale: c.get("locale"),
      note: detail.note,
      mdast: detail.mdast,
      related: related.map((note) => toPublicNote(note)),
      og: {
        title: detail.note.title,
        description: detail.note.summary,
        image: `/og/notes/${detail.note.slug}`,
        type: "article",
      },
      // schema.org BlogPosting (検索エンジン向け構造化データ)。絶対 URL で構築する。
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: detail.note.title,
        description: detail.note.summary,
        image: `${origin}/og/notes/${detail.note.slug}`,
        datePublished: detail.note.publishedOn,
        dateModified: detail.note.lastModifiedOn,
        author: { "@type": "Person", name: "yantene", url: `${origin}/` },
        publisher: { "@type": "Person", name: "yantene" },
        mainEntityOfPage: `${origin}/notes/${detail.note.slug}`,
        keywords: detail.note.tags,
      },
    });
  });

  return router;
}
