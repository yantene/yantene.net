import { Hono } from "hono";
import { toNoteDetail } from "./note-detail-view";
import { extractHeadings } from "./toc-headings";
import { recordNoteView, type NoteViewRecording } from "./view-recording";
import type { NoteDetail, PublicNoteMeta } from "./note-detail-view";
import type { TocHeading } from "./toc-headings";
import type { Root } from "mdast";
import {
  InvalidNoteSlugError,
  NoteNotFoundError,
  NoteSlug,
  NoteTag,
} from "~/backend/domain/note";
import { toPublicNote, type PublicNote } from "~/backend/handlers/note-view";
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
/** 内部用。API に出す NoteDetail に加えて、閲覧の記録に要る id を併せて返す。 */
interface ResolvedNote {
  readonly detail: NoteDetail;
  readonly noteId: string;
}

async function loadNoteDetail(
  env: Env,
  slug: NoteSlug,
): Promise<ResolvedNote | undefined> {
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
  return { detail: toNoteDetail(note, mdast), noteId: note.id };
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
): Promise<ResolvedNote | undefined> {
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
    const resolved = await resolveDetail(c.env, slugParam);
    if (resolved === undefined) throw new NoteNotFoundError(slugParam);
    return c.json(resolved.detail);
  });

  return router;
}

export type NoteDetailPageData =
  | { readonly found: false }
  | {
      readonly found: true;
      readonly note: PublicNoteMeta;
      /** パース済み MDAST。loader を通して渡すため具体型で持つ (unknown だと型が落ちる)。 */
      readonly mdast: Root;
      readonly related: readonly PublicNote[];
      readonly headings: readonly TocHeading[];
      /** schema.org BlogPosting (検索エンジン向け構造化データ)。絶対 URL で構築する。 */
      readonly jsonLd: Record<string, unknown>;
    };

/**
 * ノート詳細ページのデータを読む (Composition Root)。認証不要。
 * 存在しない slug は throw せず `found: false` を返し、呼び出し側 (loader) が
 * 404 ステータスで not-found 状態のページを描画する。
 */
export async function loadNoteDetailPage(
  env: Env,
  slugParam: string,
  origin: string,
  recording: NoteViewRecording | null,
): Promise<NoteDetailPageData> {
  const resolved = await resolveDetail(env, slugParam);
  if (resolved === undefined) return { found: false };

  const detail = resolved.detail;
  // 読まれた記事として数える。応答を返し終えてから走るので、描画は待たされない。
  if (recording !== null) {
    recordNoteView(
      env,
      { id: resolved.noteId, slug: detail.note.slug },
      recording,
    );
  }

  const relatedTags = detail.note.tags.map((tag) => NoteTag.create(tag));
  const query = new D1NoteQueryRepository(env.D1);
  const related = await query.findRelated(
    NoteSlug.create(detail.note.slug),
    relatedTags,
    RELATED_LIMIT,
  );

  const mdast = detail.mdast as Root;
  return {
    found: true,
    note: detail.note,
    mdast,
    related: related.map((note) => toPublicNote(note)),
    headings: extractHeadings(mdast),
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
  };
}
