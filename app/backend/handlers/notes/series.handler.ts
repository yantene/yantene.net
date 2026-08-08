import { toPublicNote, type PublicNote } from "~/backend/handlers/note-view";
import { D1NoteQueryRepository } from "~/backend/infra/d1/repositories";

export interface SeriesPageData {
  /** 連載の表示名。該当が無ければ null (呼び出し側が 404 を返す)。 */
  readonly name: string | null;
  readonly notes: readonly PublicNote[];
}

/**
 * 連載 (シリーズ) 索引ページのデータを読む (Composition Root)。認証不要。
 * 記事は seriesOrder 昇順。該当が無ければ name: null を返す。
 */
export async function loadSeriesPage(
  env: Env,
  slug: string,
): Promise<SeriesPageData> {
  const found = await new D1NoteQueryRepository(env.D1).listBySeries(slug);
  const notes = found.map((note) => toPublicNote(note));

  if (notes.length === 0) return { name: null, notes: [] };

  return { name: notes[0].series?.name ?? slug, notes };
}
