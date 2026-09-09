import type { Article, ArticleListResult } from "~/backend/domain/article";
import {
  parseArticleSort,
  parsePagination,
  toPublicArticle,
  toPublicArticleList,
  type PublicArticleList,
} from "~/backend/handlers/article-view";
import {
  D1ArticleQueryRepository,
  D1ArticleViewQueryRepository,
} from "~/backend/infra/d1/repositories";

/**
 * ホームに出す「最近」の件数。
 *
 * ホームは一覧の代わりではなく入口なので、続きは足さずここで打ち切って `/articles` へ送る。
 * 年の区切りが 2〜3 個現れる程度に留め、ヒーローの直後が記事で埋まらないようにする。
 */
const RECENT_COUNT = 5;

/** ホームに出す「よく読まれている」の件数。脇に添える柱なので短く。 */
const POPULAR_COUNT = 4;

/**
 * 検索で拾う最大件数。
 *
 * 関連度の低いところまで辿っても読まれないので、ここで打ち切る。タグとの併用では
 * この中から絞るため、絞り込みで取りこぼさない程度には広く取っておく。
 */
const SEARCH_LIMIT = 30;

export interface ArticlesListPageData extends PublicArticleList {
  /** 検索語 (未指定なら空文字)。 */
  readonly query: string;
  /** ページ送りリンクの再構築に使う、リクエストされた並び順。 */
  readonly sort: {
    readonly sortBy: string | null;
    readonly order: string | null;
  };
}

/**
 * 記事一覧ページのデータを読む (Composition Root)。
 *
 * 検索・タグ絞り込み・ページング・並び順をすべてクエリ文字列から解決する。このページが
 * 検索の入口と結果を兼ねるので、絞り込みの状態は URL にだけ持たせる (共有できて、
 * 戻るが効く)。
 */
export async function loadArticlesListPage(env: Env, url: URL): Promise<ArticlesListPageData> {
  const { page, perPage, limit, offset } = parsePagination(
    url.searchParams.get("page") ?? undefined,
    url.searchParams.get("per-page") ?? undefined,
  );
  const { sortBy, direction } = parseArticleSort(
    url.searchParams.get("sort-by") ?? undefined,
    url.searchParams.get("order") ?? undefined,
  );
  const searchQuery = (url.searchParams.get("q") ?? "").trim();

  const query = new D1ArticleQueryRepository(env.D1);
  const isSearching = searchQuery.length > 0;
  const list = isSearching
    ? await searchArticles(query, searchQuery)
    : await query.list({ limit, offset, sortBy, direction });

  /*
   * 検索は上限までを一度に返すので、続きは無い。1 ページに収めて継ぎ足しを起こさない。
   * 起こしてしまうと、続きを取る API には検索語が渡らず、無関係な記事が混ざる。
   */
  const paged = isSearching
    ? toPublicArticleList(list, 1, Math.max(list.articles.length, 1))
    : toPublicArticleList(list, page, perPage);

  return {
    ...paged,
    query: searchQuery,
    sort: {
      sortBy: url.searchParams.get("sort-by"),
      order: url.searchParams.get("order"),
    },
  };
}

/** 検索語で引く。索引が返す関連度順をそのまま保つ。 */
async function searchArticles(
  query: D1ArticleQueryRepository,
  searchQuery: string,
): Promise<ArticleListResult> {
  const articles = await query.search(searchQuery, SEARCH_LIMIT);
  // 検索は関連度順にすべて返すので、ページ送りの母数は件数そのものになる。
  return { articles, total: articles.length };
}

export interface HomePageData {
  /** 公開日の新しい順。 */
  readonly recent: PublicArticleList["articles"];
  /**
   * よく読まれている順。
   *
   * 読まれた回数から並べる (詳しくは domain/article-view/view-ranking)。出発点は投稿日の
   * 重みなので、まだ読まれていない記事も新しい順に候補へ入る。
   */
  readonly popular: PublicArticleList["articles"];
}

/**
 * ホームのデータを読む (Composition Root)。
 *
 * ホームは一覧の代わりではなく入口なので、続きは足さずここで打ち切る。全件を辿る導線は
 * `/articles` が持つ。
 */
export async function loadHomePage(env: Env): Promise<HomePageData> {
  const query = new D1ArticleQueryRepository(env.D1);

  const recent = await query.list({
    limit: RECENT_COUNT,
    offset: 0,
    sortBy: "publishedOn",
    direction: "desc",
  });

  return {
    recent: toPublicArticleList(recent, 1, RECENT_COUNT).articles,
    popular: await loadPopularArticles(env, query),
  };
}

/**
 * よく読まれている記事を読む。
 *
 * 順位付けは D1 に任せる。スコアを対数で持っているおかげで、保存した列をそのまま
 * 降順に並べれば人気順になり、読み出したあとに重みを計算し直す必要がない。
 */
async function loadPopularArticles(
  env: Env,
  query: D1ArticleQueryRepository,
): Promise<PublicArticleList["articles"]> {
  const rankedIds = await new D1ArticleViewQueryRepository(env.D1).listPopularArticleIds(
    POPULAR_COUNT,
  );
  if (rankedIds.length === 0) return [];

  // 引き直した行を、順位の並びに戻す。
  const articles = await query.findByIds(rankedIds);
  const byId = new Map<string, Article>(articles.map((article) => [article.id, article]));
  return rankedIds
    .map((id) => byId.get(id))
    .filter((article) => article !== undefined)
    .map((article) => toPublicArticle(article));
}
