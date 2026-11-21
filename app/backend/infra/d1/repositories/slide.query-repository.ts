import type { ISlideQueryRepository, Slide, SlideSlug } from "~/backend/domain/slide";
import type { SQL } from "drizzle-orm";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { rowToSlide } from "./slide-row";
import { contentStatuses, isListedToReaders, isReachableByReaders } from "~/backend/domain/shared";
import { slides } from "~/backend/infra/d1/schema";

/** 読み手に差し出してよい status (一覧・フィード・sitemap)。 */
const LISTED_STATUSES = contentStatuses.filter((status) => isListedToReaders(status));

/** URL を直に打った読み手に見せてよい status。 */
const REACHABLE_STATUSES = contentStatuses.filter((status) => isReachableByReaders(status));

/**
 * スライドの読み取り口。**作りは記事のもの (D1ArticleQueryRepository) と同じ** (ADR 0040)。
 *
 * コンストラクタは private で、{@link D1SlideQueryRepository.forReaders} か
 * {@link D1SlideQueryRepository.forAdmin} でしか作れない。新しい配信経路を書く人は
 * どちらかを選ばされ、既定で漏れる形にならない。
 *
 * `forReaders` がどの status を通すかは**メソッドごとに固定**してある。
 */
export class D1SlideQueryRepository implements ISlideQueryRepository {
  private readonly db;

  private constructor(
    d1: D1Database,
    /** false なら status で絞らない (管理者向け)。 */
    private readonly restrictToReaders: boolean,
  ) {
    this.db = drizzle(d1);
  }

  /**
   * 読み手向け。一覧・フィード・sitemap・OG・スライドのページはこれ。
   *
   * 迷ったらこちらを使う。管理者に見せたいときだけ {@link forAdmin} を選ぶ。
   */
  static forReaders(d1: D1Database): D1SlideQueryRepository {
    return new D1SlideQueryRepository(d1, true);
  }

  /**
   * すべての status を返す。**refresh と、管理者に見せると決めた経路だけ。**
   *
   * これで引いた結果を応答に載せるときは `Cache-Control: private, no-store` を付ける
   * こと (`PRIVATE_CACHE_HEADERS`)。
   */
  static forAdmin(d1: D1Database): D1SlideQueryRepository {
    return new D1SlideQueryRepository(d1, false);
  }

  /** 一覧で通す status の条件。管理者向けなら無条件。 */
  private get listedFilter(): SQL | undefined {
    return this.restrictToReaders ? inArray(slides.status, LISTED_STATUSES) : undefined;
  }

  /** URL 直打ちで通す status の条件。管理者向けなら無条件。 */
  private get reachableFilter(): SQL | undefined {
    return this.restrictToReaders ? inArray(slides.status, REACHABLE_STATUSES) : undefined;
  }

  /**
   * 出した日の新しい順で返す。読み手向けなら `published` だけ。
   *
   * 第 2 キーに slug を置くのは、同じ日に 2 本出したときに並びが揺れないようにするため。
   * `published_on` は `YYYY-MM-DD` の字なので、字の順がそのまま日付の順になる。
   */
  async list(): Promise<readonly Slide[]> {
    const rows = await this.db
      .select()
      .from(slides)
      .where(this.listedFilter)
      .orderBy(desc(slides.publishedOn), asc(slides.slug));
    return rows.map((row) => rowToSlide(row));
  }

  /** slug で 1 本引く。読み手向けなら `published` と `unlisted`。 */
  async findBySlug(slug: SlideSlug): Promise<Slide | undefined> {
    const [row] = await this.db
      .select()
      .from(slides)
      .where(and(eq(slides.slug, slug.toString()), this.reachableFilter))
      .limit(1);
    return row === undefined ? undefined : rowToSlide(row);
  }

  /**
   * refresh の変更検出に使う。**これを呼ぶのは `forAdmin` だけ** — 読み手向けで引くと
   * 下書きが落ちて、コンテンツリポジトリから消えた下書きが D1 に残り続ける。
   *
   * それでも `forReaders` で絞るのは、この class の不変条件を「`forReaders` は一覧に
   * `published` 以外を返さない」に保つため (記事の読み取り口と同じ)。
   */
  async listSourceHashes(): Promise<ReadonlyMap<string, string>> {
    const rows = await this.db
      .select({ slug: slides.slug, sourceHash: slides.sourceHash })
      .from(slides)
      .where(this.listedFilter);
    return new Map(rows.map((row) => [row.slug, row.sourceHash]));
  }
}
