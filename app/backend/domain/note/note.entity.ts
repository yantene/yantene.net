import type { ImageUrl } from "./image-url.vo";
import type { NoteSlug } from "./note-slug.vo";
import type { NoteTitle } from "./note-title.vo";
import type { Temporal } from "@js-temporal/polyfill";
import type {
  EntityId,
  IPersisted,
  IUnpersisted,
} from "~/backend/domain/shared";

export type NoteId = EntityId<"Note">;

interface NoteFields<T extends IPersisted | IUnpersisted> {
  readonly id: T["id"] extends string ? NoteId : undefined;
  readonly slug: NoteSlug;
  readonly title: NoteTitle;
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
   * (Artifacts のツリーが返すファイルハッシュ)。
   */
  readonly sourceHash: string;
  /** D1 行の作成・更新時刻 (永続化メタデータ。コンテンツ日付とは別)。 */
  readonly createdAt: T["createdAt"];
  readonly updatedAt: T["updatedAt"];
}

/**
 * ノート集約。Markdown 記事のメタデータを表す。
 * 本文 (MDAST) と画像アセットは別ストレージ (R2) にあり、本エンティティは
 * D1 のメタデータインデックスに対応する。
 */
export class Note<T extends IPersisted | IUnpersisted = IPersisted> {
  private constructor(private readonly fields: NoteFields<T>) {}

  static create(params: {
    slug: NoteSlug;
    title: NoteTitle;
    summary: string;
    imageUrl?: ImageUrl;
    publishedOn: Temporal.PlainDate;
    lastModifiedOn: Temporal.PlainDate;
    sourceHash: string;
  }): Note<IUnpersisted> {
    return new Note({
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
    id: NoteId;
    slug: NoteSlug;
    title: NoteTitle;
    summary: string;
    imageUrl: ImageUrl | undefined;
    publishedOn: Temporal.PlainDate;
    lastModifiedOn: Temporal.PlainDate;
    sourceHash: string;
    createdAt: Temporal.Instant;
    updatedAt: Temporal.Instant;
  }): Note {
    return new Note(params);
  }

  get id(): NoteFields<T>["id"] {
    return this.fields.id;
  }

  get slug(): NoteSlug {
    return this.fields.slug;
  }

  get title(): NoteTitle {
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

  get createdAt(): NoteFields<T>["createdAt"] {
    return this.fields.createdAt;
  }

  get updatedAt(): NoteFields<T>["updatedAt"] {
    return this.fields.updatedAt;
  }
}
