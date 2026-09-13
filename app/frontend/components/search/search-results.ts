/**
 * コマンドパレットが読む検索結果。
 *
 * 描画から切り離してあるのは、ネットワーク越しの unknown を読み取る部分を DOM 無しで
 * 確かめられるようにするため (article-list-payload.ts と同じ理由)。
 */

/** 結果 1 件。パレットが出すのは題と要約だけなので、そこまでしか読まない。 */
export interface SearchResult {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
}

/** 記事の一覧ページ。パレットで決めきれないときの行き先。 */
export function searchPagePath(query: string): string {
  return `/articles?${new URLSearchParams({ q: query }).toString()}`;
}

/** 記事そのもの。 */
export function articlePagePath(slug: string): string {
  return `/articles/${slug}`;
}

/**
 * `/api/v1/search` から返る JSON を読み取る。
 *
 * 相手はネットワーク越しの unknown なので、型注釈で押し通さずに 1 つずつ確かめる。
 * 形が違えば null を返し、呼び出し側が読み込み失敗として扱う。
 */
export function parseSearchPayload(value: unknown): readonly SearchResult[] | null {
  if (!isRecord(value)) return null;

  const rawArticles = value["articles"];
  if (!Array.isArray(rawArticles)) return null;

  const results: SearchResult[] = [];
  for (const raw of rawArticles) {
    const result = parseResult(raw);
    if (result === null) return null;
    results.push(result);
  }
  return results;
}

function parseResult(value: unknown): SearchResult | null {
  if (!isRecord(value)) return null;

  const { slug, title, summary } = value;
  if (typeof slug !== "string") return null;
  if (typeof title !== "string") return null;
  if (typeof summary !== "string") return null;

  return { slug, title, summary };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** 検索の取り方。パレットは口だけを知っていて、stories とテストが差し替える。 */
export type SearchArticles = (
  query: string,
  signal: AbortSignal,
) => Promise<readonly SearchResult[]>;

/**
 * 既定の取り方。公開 API をそのまま叩く。
 *
 * 打つたびに投げるので、前の要求は呼ぶ側が `signal` で畳む。畳まなかった要求が
 * 遅れて返ると、いま打っている語と違う結果が出る。
 */
export const searchArticles: SearchArticles = async (query, signal) => {
  const response = await fetch(`/api/v1/search?${new URLSearchParams({ q: query }).toString()}`, {
    headers: { accept: "application/json" },
    signal,
  });
  if (!response.ok) throw new Error(`status ${String(response.status)}`);

  const results = parseSearchPayload(await response.json());
  if (results === null) throw new Error("unexpected payload");
  return results;
};
