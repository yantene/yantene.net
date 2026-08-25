import type { CopyrightYears } from "~/backend/handlers/copyright-years";
import { D1NoteQueryRepository } from "~/backend/infra/d1/repositories";

/**
 * 著作権表示の期間を読む (Composition Root)。
 *
 * 全ページのフッターが通るので、D1 への往復が 1 つ増える。両端は集約 1 回で引けるため
 * 記事数が増えても重くならない。
 *
 * **必ず loader のような I/O の内側から呼ぶこと。** ノートが 1 件も無いときの
 * 落とし先として時計を読む。Cloudflare Workers は I/O の外 (モジュールのトップレベル
 * 評価時) の時刻を Unix epoch 0 に固定するため、そこで年を求めると本番の SSR だけが
 * 1970 年になる (#156)。ローカルの workerd では再現しないので実装時には気づけない。
 */
export async function loadCopyrightYears(env: Env): Promise<CopyrightYears> {
  const span = await new D1NoteQueryRepository(env.D1).findPublishedYearSpan();
  if (span !== undefined) return span;

  // まだ 1 件も公開していないサイト。出せる期間が無いので、いまの年だけを出す。
  const currentYear = new Date().getFullYear();
  return { from: currentYear, to: currentYear };
}
