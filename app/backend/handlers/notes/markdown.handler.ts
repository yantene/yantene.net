import { Hono } from "hono";
import { contentCacheControlFor } from "./content-cache-control";
import { InvalidNoteSlugError, NoteSlug } from "~/backend/domain/note";
import { D1NoteQueryRepository } from "~/backend/infra/d1/repositories";
import { R2NoteContentCache } from "~/backend/infra/r2/r2-note-content-cache";
import { notFoundResponse } from "~/lib/problem-details";

const MARKDOWN_SUFFIX = ".md";
const MARKDOWN_CONTENT_TYPE = "text/markdown; charset=utf-8";

/**
 * ノートの原文 Markdown を返す公開ルータ (`/notes/<slug>.md`)。認証不要。
 *
 * ページではなく「ファイルとしてのノート」を返すエンドポイントなので、React Router へ
 * 委譲せず Hono 側で完結させる (ADR 0006)。`.md` は index.ts で `app.all("*")` より前に
 * マウントし、素の `/notes/<slug>` はこれまで通りページ描画に落ちる。
 *
 * slug に `.` は使えない (NoteSlug の制約) ため、`<slug>.md` を別のノートと取り違える
 * 余地はない。`.md` を落とした残りが slug として妥当でなければ 404。
 *
 * 本文は正本そのまま (フロントマター込み・画像の相対パスも書き換えない) を返す。
 * 解決済みの URL が要るクライアントには MDAST を返す JSON API がある (ADR 0005)。
 */
export function createNoteMarkdownRouter(): Hono<{ Bindings: Env }> {
  const router = new Hono<{ Bindings: Env }>();

  // `.` は文字クラスで書く。エスケープを使うと Hono がパスからパラメータ名を型推論
  // できなくなる (String.raw が必要になり、リテラル型でなくなるため)。
  router.get("/:file{[^/]+[.]md}", async (c) => {
    const file = c.req.param("file");
    let slug: NoteSlug;
    try {
      slug = NoteSlug.create(file.slice(0, -MARKDOWN_SUFFIX.length));
    } catch (error) {
      if (error instanceof InvalidNoteSlugError) {
        return notFoundResponse("note not found");
      }
      throw error;
    }

    // D1 と R2 は共に slug 依存で互いに独立なので並行に読む。
    const [note, markdown] = await Promise.all([
      new D1NoteQueryRepository(c.env.D1).findBySlug(slug),
      new R2NoteContentCache(c.env.R2).getSource(slug),
    ]);

    // D1 にメタデータが無い = そもそも存在しないノート。
    if (note === undefined) return notFoundResponse("note not found");
    // D1 に在るのに原文が無い = キャッシュ不整合。静かに 404 で隠さず throw する
    // (fail-loud)。実装追加の直後は force refresh で原文を流し込む必要がある。
    if (markdown === undefined) {
      throw new Error(
        `Markdown source cache is missing for an indexed note: ${slug.toString()}`,
      );
    }

    return new Response(markdown, {
      headers: {
        "Content-Type": MARKDOWN_CONTENT_TYPE,
        // ブラウザで開いたら (可能なら) その場で見せる。保存時のファイル名だけ揃える。
        "Content-Disposition": `inline; filename="${slug.toString()}${MARKDOWN_SUFFIX}"`,
        "Cache-Control": contentCacheControlFor(c.env),
      },
    });
  });

  return router;
}
