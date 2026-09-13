import type { WorkName } from "./work-name.vo";
import type { WorkSlug } from "./work-slug.vo";
import type { WorkSummary } from "./work-summary.vo";
import type { WorkUrl } from "./work-url.vo";
import type { Temporal } from "@js-temporal/polyfill";
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
    sourceHash: string;
  }): Work<IUnpersisted> {
    return new Work({
      id: undefined,
      slug: params.slug,
      name: params.name,
      summary: params.summary,
      url: params.url,
      position: params.position,
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
