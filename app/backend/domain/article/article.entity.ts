import type { ImageUrl } from "./image-url.vo";
import type { ArticleSlug } from "./article-slug.vo";
import type { ArticleTitle } from "./article-title.vo";
import type { Temporal } from "@js-temporal/polyfill";
import type { EntityId, IPersisted, IUnpersisted } from "~/backend/domain/shared";

export type ArticleId = EntityId<"Article">;

interface ArticleFields<T extends IPersisted | IUnpersisted> {
  readonly id: T["id"] extends string ? ArticleId : undefined;
  readonly slug: ArticleSlug;
  readonly title: ArticleTitle;
  /** MDAST から自動抽出した一覧用の要約 (先頭 160 文字)。手書きしない。 */
  readonly summary: string;
  /** カバー画像 URL。フロントマターに imageUrl が無ければ undefined。 */
  readonly imageUrl: ImageUrl | undefined;
  /** フロントマター由来の公開日 (日付のみ)。 */
  readonly publishedOn: Temporal.PlainDate;
  /** フロントマター由来の最終更新日 (日付のみ)。 */
  readonly lastModifiedOn: Temporal.PlainDate;
  /**
   * コンテンツ正本 (Markdown) のリビジョン識別子。refresh 時の変更検出に使う
   * (正本のツリーが返すファイルハッシュ)。
   */
  readonly sourceHash: string;
  /** D1 行の作成・更新時刻 (永続化メタデータ。コンテンツ日付とは別)。 */
  readonly createdAt: T["createdAt"];
  readonly updatedAt: T["updatedAt"];
}

/**
 * 記事集約。Markdown 記事のメタデータを表す。
 * 本文 (MDAST) と画像アセットは別ストレージ (R2) にあり、本エンティティは
 * D1 のメタデータインデックスに対応する。
 */
export class Article<T extends IPersisted | IUnpersisted = IPersisted> {
  private constructor(private readonly fields: ArticleFields<T>) {}

  static create(params: {
    slug: ArticleSlug;
    title: ArticleTitle;
    summary: string;
    imageUrl?: ImageUrl;
    publishedOn: Temporal.PlainDate;
    lastModifiedOn: Temporal.PlainDate;
    sourceHash: string;
  }): Article<IUnpersisted> {
    return new Article({
      id: undefined,
      slug: params.slug,
      title: params.title,
      summary: params.summary,
      imageUrl: params.imageUrl,
      publishedOn: params.publishedOn,
      lastModifiedOn: params.lastModifiedOn,
      sourceHash: params.sourceHash,
      createdAt: undefined,
      updatedAt: undefined,
    });
  }

  static reconstruct(params: {
    id: ArticleId;
    slug: ArticleSlug;
    title: ArticleTitle;
    summary: string;
    imageUrl: ImageUrl | undefined;
    publishedOn: Temporal.PlainDate;
    lastModifiedOn: Temporal.PlainDate;
    sourceHash: string;
    createdAt: Temporal.Instant;
    updatedAt: Temporal.Instant;
  }): Article {
    return new Article(params);
  }

  get id(): ArticleFields<T>["id"] {
    return this.fields.id;
  }

  get slug(): ArticleSlug {
    return this.fields.slug;
  }

  get title(): ArticleTitle {
    return this.fields.title;
  }

  get summary(): string {
    return this.fields.summary;
  }

  get imageUrl(): ImageUrl | undefined {
    return this.fields.imageUrl;
  }

  get publishedOn(): Temporal.PlainDate {
    return this.fields.publishedOn;
  }

  get lastModifiedOn(): Temporal.PlainDate {
    return this.fields.lastModifiedOn;
  }

  get sourceHash(): string {
    return this.fields.sourceHash;
  }

  get createdAt(): ArticleFields<T>["createdAt"] {
    return this.fields.createdAt;
  }

  get updatedAt(): ArticleFields<T>["updatedAt"] {
    return this.fields.updatedAt;
  }
}
