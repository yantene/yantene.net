import type { WorkName } from "./work-name.vo";
import type { WorkPeriod } from "./work-period.vo";
import type { WorkRole } from "./work-role.vo";
import type { WorkScreenshot } from "./work-screenshot.vo";
import type { WorkSlug } from "./work-slug.vo";
import type { WorkSummary } from "./work-summary.vo";
import type { WorkUrl } from "./work-url.vo";
import type { Temporal } from "@js-temporal/polyfill";
import type { ArticleSlug } from "~/backend/domain/article";
import { WorkStack } from "./work-stack.vo";
import type { EntityId, IPersisted, IUnpersisted } from "~/backend/domain/shared";

export type WorkId = EntityId<"Work">;

interface WorkFields<T extends IPersisted | IUnpersisted> {
  readonly id: T["id"] extends string ? WorkId : undefined;
  readonly slug: WorkSlug;
  readonly name: WorkName;
  /** `/about` と `/works` に並ぶ 1 行。記事の要約と違って手で書く。 */
  readonly summary: WorkSummary;
  /** 作品そのものの在り処。外に出していなければ undefined。 */
  readonly url: WorkUrl | undefined;
  /**
   * 並び順。小さいほうが先。
   *
   * **日付で並べない。** 作った順に並べると、読み手が最初に受け取るのが年表になる。
   * 何をいちばん見てほしいかは書き手が決めることなので、フロントマターに書いた数で
   * 決める (ADR 0042)。
   *
   * 非負の整数であることは書き込み経路 (`work-content-parser.ts`) が担保する。
   */
  readonly position: number;
  /** 使った技術の名前の並び。書いていなければ空。 */
  readonly stack: WorkStack;
  /** 作った時期。書いていなければ undefined。**並べ替えには使わない** (並びは position)。 */
  readonly period: WorkPeriod | undefined;
  /** 自分の役割 (1 行)。書いていなければ undefined。 */
  readonly role: WorkRole | undefined;
  /** `/works` で大きく出すかどうか。書いていなければ false。 */
  readonly featured: boolean;
  /** スクリーンショット。書いた順。1 枚目が一覧と OG 画像の顔になる。 */
  readonly screenshots: readonly WorkScreenshot[];
  /**
   * この作品について書いた記事の slug。書いた順。
   *
   * ⚠️ **読み手に見せてよい記事とは限らない。** 下書きの slug も、まだ無い記事の slug も
   * 入る。出す側は必ず記事の読み手向けの読み口で引き直し、**この並びをそのまま応答に
   * 載せないこと** (slug だけでも、書きかけの記事が在ることが漏れる)。
   */
  readonly articleSlugs: readonly ArticleSlug[];
  /**
   * コンテンツリポジトリ (Markdown) のリビジョン識別子。refresh 時の変更検出に使う
   * (md + アセットの合成ハッシュ)。
   */
  readonly sourceHash: string;
  /** D1 行の作成・更新時刻 (永続化メタデータ)。 */
  readonly createdAt: T["createdAt"];
  readonly updatedAt: T["updatedAt"];
}

/**
 * 作品集約。作ったものを 1 件表す。
 *
 * 詳しい説明 (MDAST) と画像は R2 にあり、このエンティティが表すのは D1 に置く
 * メタデータ。概要をここに持つのは、`/about` と `/works` が本文を読まずに並べるため。
 */
export class Work<T extends IPersisted | IUnpersisted = IPersisted> {
  private constructor(private readonly fields: WorkFields<T>) {}

  static create(params: {
    slug: WorkSlug;
    name: WorkName;
    summary: WorkSummary;
    url?: WorkUrl;
    position: number;
    stack?: WorkStack;
    period?: WorkPeriod;
    role?: WorkRole;
    featured?: boolean;
    screenshots?: readonly WorkScreenshot[];
    articleSlugs?: readonly ArticleSlug[];
    sourceHash: string;
  }): Work<IUnpersisted> {
    return new Work({
      id: undefined,
      slug: params.slug,
      name: params.name,
      summary: params.summary,
      url: params.url,
      position: params.position,
      stack: params.stack ?? WorkStack.empty(),
      period: params.period,
      role: params.role,
      featured: params.featured ?? false,
      screenshots: params.screenshots ?? [],
      articleSlugs: params.articleSlugs ?? [],
      sourceHash: params.sourceHash,
      createdAt: undefined,
      updatedAt: undefined,
    });
  }

  static reconstruct(params: {
    id: WorkId;
    slug: WorkSlug;
    name: WorkName;
    summary: WorkSummary;
    url: WorkUrl | undefined;
    position: number;
    stack: WorkStack;
    period: WorkPeriod | undefined;
    role: WorkRole | undefined;
    featured: boolean;
    screenshots: readonly WorkScreenshot[];
    articleSlugs: readonly ArticleSlug[];
    sourceHash: string;
    createdAt: Temporal.Instant;
    updatedAt: Temporal.Instant;
  }): Work {
    return new Work(params);
  }

  get id(): WorkFields<T>["id"] {
    return this.fields.id;
  }

  get slug(): WorkSlug {
    return this.fields.slug;
  }

  get name(): WorkName {
    return this.fields.name;
  }

  get summary(): WorkSummary {
    return this.fields.summary;
  }

  get url(): WorkUrl | undefined {
    return this.fields.url;
  }

  get position(): number {
    return this.fields.position;
  }

  get stack(): WorkStack {
    return this.fields.stack;
  }

  get period(): WorkPeriod | undefined {
    return this.fields.period;
  }

  get role(): WorkRole | undefined {
    return this.fields.role;
  }

  get featured(): boolean {
    return this.fields.featured;
  }

  get screenshots(): readonly WorkScreenshot[] {
    return this.fields.screenshots;
  }

  /** ⚠️ 読み手に見せてよい記事とは限らない。そのまま応答に載せないこと。 */
  get articleSlugs(): readonly ArticleSlug[] {
    return this.fields.articleSlugs;
  }

  get sourceHash(): string {
    return this.fields.sourceHash;
  }

  get createdAt(): WorkFields<T>["createdAt"] {
    return this.fields.createdAt;
  }

  get updatedAt(): WorkFields<T>["updatedAt"] {
    return this.fields.updatedAt;
  }
}
