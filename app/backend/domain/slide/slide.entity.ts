import type { SlideEvent } from "./slide-event.vo";
import type { SlideSlug } from "./slide-slug.vo";
import type { SlideTitle } from "./slide-title.vo";
import type { Temporal } from "@js-temporal/polyfill";
import type { ContentStatus, EntityId, IPersisted, IUnpersisted } from "~/backend/domain/shared";

export type SlideId = EntityId<"Slide">;

interface SlideFields<T extends IPersisted | IUnpersisted> {
  readonly id: T["id"] extends string ? SlideId : undefined;
  readonly slug: SlideSlug;
  readonly title: SlideTitle;
  /** 出した日。一覧とフィードはこの新しい順に並ぶ。 */
  readonly publishedOn: Temporal.PlainDate;
  /** 発表の場。発表しなかったスライドでは undefined。 */
  readonly event: SlideEvent | undefined;
  /**
   * 一覧とフィードに出す要約。手では書かず、語り (地の文) の書き出しから作る。
   * 語りを書いていないスライドでは空。
   */
  readonly summary: string;
  /**
   * ページの数 (表紙と「参考」を含む)。一覧が本文を読まずに出すために持つ。
   *
   * 正の整数であることは書き込み経路 (同期) が担保する。
   */
  readonly pageCount: number;
  /**
   * 段階と公開範囲。記事と同じ語彙で、読み手への振る舞いも同じ (ADR 0040)。
   *
   * **この値は「同期するか」を決めない。** どの status のスライドも D1 / R2 に載る。
   * 読み手から隠すのは読み取り口 (`forReaders`) の役目。
   */
  readonly status: ContentStatus;
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
 * スライド集約。発表のための 1 本を表す (ADR 0052)。
 *
 * 本文 (MDAST) と画像は R2 にあり、このエンティティが表すのは D1 に置くメタデータ。
 * 要約とページの数をここに持つのは、`/slides` とフィードが本文を読まずに並べるため。
 *
 * 公開範囲は記事と同じ `status` で持つ (ADR 0040)。
 */
export class Slide<T extends IPersisted | IUnpersisted = IPersisted> {
  private constructor(private readonly fields: SlideFields<T>) {}

  static create(params: {
    slug: SlideSlug;
    title: SlideTitle;
    publishedOn: Temporal.PlainDate;
    event?: SlideEvent;
    summary: string;
    pageCount: number;
    status: ContentStatus;
    sourceHash: string;
  }): Slide<IUnpersisted> {
    return new Slide({
      id: undefined,
      slug: params.slug,
      title: params.title,
      publishedOn: params.publishedOn,
      event: params.event,
      summary: params.summary,
      pageCount: params.pageCount,
      status: params.status,
      sourceHash: params.sourceHash,
      createdAt: undefined,
      updatedAt: undefined,
    });
  }

  static reconstruct(params: {
    id: SlideId;
    slug: SlideSlug;
    title: SlideTitle;
    publishedOn: Temporal.PlainDate;
    event: SlideEvent | undefined;
    summary: string;
    pageCount: number;
    status: ContentStatus;
    sourceHash: string;
    createdAt: Temporal.Instant;
    updatedAt: Temporal.Instant;
  }): Slide {
    return new Slide(params);
  }

  get id(): SlideFields<T>["id"] {
    return this.fields.id;
  }

  get slug(): SlideSlug {
    return this.fields.slug;
  }

  get title(): SlideTitle {
    return this.fields.title;
  }

  get publishedOn(): Temporal.PlainDate {
    return this.fields.publishedOn;
  }

  get event(): SlideEvent | undefined {
    return this.fields.event;
  }

  get summary(): string {
    return this.fields.summary;
  }

  get pageCount(): number {
    return this.fields.pageCount;
  }

  get status(): ContentStatus {
    return this.fields.status;
  }

  get sourceHash(): string {
    return this.fields.sourceHash;
  }

  get createdAt(): SlideFields<T>["createdAt"] {
    return this.fields.createdAt;
  }

  get updatedAt(): SlideFields<T>["updatedAt"] {
    return this.fields.updatedAt;
  }
}
