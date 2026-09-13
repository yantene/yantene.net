import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { rowToArticle } from "./article-row";
import type {
  IArticleQueryRepository,
  Article,
  ArticleListQuery,
  ArticleListResult,
  ArticleSlug,
  ArticleSortField,
} from "~/backend/domain/article";
import { articleStatuses, isListedToReaders, isReachableByReaders } from "~/backend/domain/article";
import { articles } from "~/backend/infra/d1/schema";

const sortColumns = {
  publishedOn: articles.publishedOn,
  lastModifiedOn: articles.lastModifiedOn,
} as const satisfies Record<ArticleSortField, unknown>;

/** 読み手に差し出してよい status (一覧・検索・関連記事・人気順)。 */
const LISTED_STATUSES = articleStatuses.filter((status) => isListedToReaders(status));

/** URL を直に打った読み手に見せてよい status。 */
const REACHABLE_STATUSES = articleStatuses.filter((status) => isReachableByReaders(status));

/**
 * 記事の読み取り口 (ADR 0040)。
 *
 * **コンストラクタは private。**{@link D1ArticleQueryRepository.forReaders} か
 * {@link D1ArticleQueryRepository.forAdmin} でしか作れない。新しい配信経路を書く人は
 * どちらかを選ばされ、既定で漏れる形にならない。
 *
 * `forReaders` がどの status を通すかは**メソッドごとに固定**してある。引数で渡せる
 * ようにすると、渡し忘れが漏れになる。「一覧に出ない」と「URL で読める」の違いは、
 * 呼ぶ側の事情ではなくメソッドの性質なので、ここに畳み込める。
 */
export class D1ArticleQueryRepository implements IArticleQueryRepository {
  private readonly db;

  private constructor(
    d1: D1Database,
    /** false なら status で絞らない (管理者向け)。 */
    private readonly restrictToReaders: boolean,
  ) {
    this.db = drizzle(d1);
  }

  /**
   * 読み手向け。一覧・フィード・sitemap・検索・関連記事・人気順・記事ページはこれ。
   *
   * 迷ったらこちらを使う。管理者に見せたいときだけ {@link forAdmin} を選ぶ。
   */
  static forReaders(d1: D1Database): D1ArticleQueryRepository {
    return new D1ArticleQueryRepository(d1, true);
  }

  /**
   * すべての status を返す。**refresh と、管理者に見せると決めた経路だけ。**
   *
   * これで引いた結果を応答に載せるときは `Cache-Control: private, no-store` を付ける
   * こと (`PRIVATE_CACHE_HEADERS`)。経路のどこかに載ると読み手に配られ、載った先で
   * 剥がす手立ては無い。
   */
  static forAdmin(d1: D1Database): D1ArticleQueryRepository {
    return new D1ArticleQueryRepository(d1, false);
  }

  /** 一覧・検索・関連記事・人気順で通す status の条件。管理者向けなら無条件。 */
  private get listedFilter(): SQL | undefined {
    return this.restrictToReaders ? inArray(articles.status, LISTED_STATUSES) : undefined;
  }

  /** URL 直打ちで通す status の条件。管理者向けなら無条件。 */
  private get reachableFilter(): SQL | undefined {
    return this.restrictToReaders ? inArray(articles.status, REACHABLE_STATUSES) : undefined;
  }

  async findBySlug(slug: ArticleSlug): Promise<Article | undefined> {
    const rows = await this.db
      .select()
      .from(articles)
      .where(and(eq(articles.slug, slug.toString()), this.reachableFilter))
      .limit(1);
    const row = rows.at(0);
    if (row === undefined) return undefined;
    return rowToArticle(row);
  }

  async list(query: ArticleListQuery): Promise<ArticleListResult> {
    const column = sortColumns[query.sortBy];
    const primary = query.direction === "asc" ? asc(column) : desc(column);
    // 同じ日付の記事同士でも順序を安定させる決定的なタイブレーカ。slug は UNIQUE
    // なので offset ページネーションで行の重複・欠落が起きない。
    const tiebreaker = asc(articles.slug);

    // 行取得と総件数取得は独立なので並行実行する (公開一覧のホットパスの往復を半減)。
    // 総件数も同じ条件で数える。行だけ絞って総数を絞り忘れると、最後のページが
    // 空になったり、ページャが在りもしないページを指したりする。
    const filter = this.listedFilter;
    const [rows, [{ value: total }]] = await Promise.all([
      this.db
        .select()
        .from(articles)
        .where(filter)
        .orderBy(primary, tiebreaker)
        .limit(query.limit)
        .offset(query.offset),
      this.db.select({ value: count() }).from(articles).where(filter),
    ]);

    return {
      articles: rows.map((row) => rowToArticle(row)),
      total,
    };
  }

  async search(query: string, limit: number): Promise<readonly Article[]> {
    const trimmed = query.trim();
    if (trimmed.length === 0) return [];

    // 索引 (articles_fts) は infra が実行時生成する仮想テーブル。未構築なら空を返す。
    let ranked: { slug: string }[];
    try {
      if (trimmed.length < 3) {
        // trigram は 3-gram なので 2 文字以下は MATCH で拾えない。LIKE 部分一致で
        // 補う (小規模コーパスなので全走査で十分)。エスケープ文字は ~ を使う。
        const escaped = trimmed.replaceAll(/[~%_]/g, (character) => `~${character}`);
        const like = `%${escaped}%`;
        ranked = await this.db.all<{ slug: string }>(
          sql`SELECT slug FROM articles_fts WHERE title LIKE ${like} ESCAPE '~' OR body LIKE ${like} ESCAPE '~' LIMIT ${limit}`,
        );
      } else {
        // クエリ全体を 1 個の FTS5 文字列トークンとして扱う (二重引用符はエスケープ)。
        const match = `"${trimmed.replaceAll('"', '""')}"`;
        ranked = await this.db.all<{ slug: string }>(
          sql`SELECT slug FROM articles_fts WHERE articles_fts MATCH ${match} ORDER BY bm25(articles_fts) LIMIT ${limit}`,
        );
      }
    } catch {
      return [];
    }
    const slugs = ranked.map((row) => row.slug);
    if (slugs.length === 0) return [];

    /*
     * 索引には `published` しか入らない (refresh が絞る。ADR 0040) ので、ここで
     * 落ちる行は普通は無い。それでも条件を書くのは、索引が古い版のまま残っている
     * 瞬間 (取り下げた直後に索引の更新が落ちた等) に取り下げた記事を出さないため。
     */
    const rows = await this.db
      .select()
      .from(articles)
      .where(and(inArray(articles.slug, slugs), this.listedFilter));
    const bySlug = new Map(rows.map((row) => [row.slug, rowToArticle(row)]));
    // bm25 の並び順を保って返す。
    return slugs
      .map((slug) => bySlug.get(slug))
      .filter((article): article is Article => article !== undefined);
  }

  /**
   * id をまとめて引く。並び順は呼び出し側が決めるので、ここでは整えない。
   * (人気順のように、DB の並びとは別の順序で使われるため)
   */
  async findByIds(ids: readonly string[]): Promise<readonly Article[]> {
    if (ids.length === 0) return [];
    const rows = await this.db
      .select()
      .from(articles)
      .where(and(inArray(articles.id, [...ids]), this.listedFilter));
    return rows.map((row) => rowToArticle(row));
  }

  async findBySlugs(slugs: readonly string[]): Promise<readonly Article[]> {
    if (slugs.length === 0) return [];
    const rows = await this.db
      .select()
      .from(articles)
      .where(and(inArray(articles.slug, [...slugs]), this.listedFilter));
    return rows.map((row) => rowToArticle(row));
  }

  /**
   * refresh の変更検出に使う。**これを呼ぶのは `forAdmin` だけ** — 読み手向けで
   * 引くと下書きが落ちて、コンテンツリポジトリから消えた下書きが D1 に残り続ける。
   *
   * それでも `forReaders` で絞るのは、この class の不変条件を
   * 「`forReaders` は `published` 以外を返さない」の一文に保つため。例外を 1 つ
   * 作ると、次に読む人はどのメソッドが例外なのかを確かめないと使えなくなる。
   */
  async listSourceHashes(): Promise<ReadonlyMap<string, string>> {
    const rows = await this.db
      .select({ slug: articles.slug, sourceHash: articles.sourceHash })
      .from(articles)
      .where(this.listedFilter);
    return new Map(rows.map((row) => [row.slug, row.sourceHash]));
  }
}
