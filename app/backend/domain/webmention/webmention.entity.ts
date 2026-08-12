import type { WebmentionAuthor } from "./webmention-author.vo";
import type { WebmentionContent } from "./webmention-content.vo";
import type { WebmentionType } from "./webmention-type.vo";
import type { WebmentionUrl } from "./webmention-url.vo";
import type { Temporal } from "@js-temporal/polyfill";
import type { NoteId, NoteSlug } from "~/backend/domain/note";
import type {
  EntityId,
  IPersisted,
  IUnpersisted,
} from "~/backend/domain/shared";

export type WebmentionId = EntityId<"Webmention">;

interface WebmentionFields<T extends IPersisted | IUnpersisted> {
  readonly id: T["id"] extends string ? WebmentionId : undefined;
  /** 送り先のノート。 */
  readonly noteId: NoteId;
  /** 送り先のノートのスラグ。URL を組み直さずに済むよう、行にも持たせる。 */
  readonly target: NoteSlug;
  /** 送り元の記事の URL。(ノート, source) の組で一意。 */
  readonly source: WebmentionUrl;
  readonly type: WebmentionType;
  readonly author: WebmentionAuthor;
  /**
   * 写した著者アイコンの識別子。写せなかったときは欠ける。
   *
   * 相手のドメインのアイコンは `img-src 'self' data:` の下では読み込めないので、
   * 自分のところへ写したものを指す。写しの失敗は異常ではないため、無い状態も持つ。
   */
  readonly authorAvatar: string | undefined;
  /** 本文。いいね等は本文を持たないので欠けうる。 */
  readonly content: WebmentionContent | undefined;
  /** 送り元の記事の公開日時 (microformats2 の `dt-published`)。読めなければ欠ける。 */
  readonly publishedAt: Temporal.Instant | undefined;
  /**
   * 初めて受け取って保存した時刻。永続化メタデータなので `IPersisted` の
   * `createdAt` に当たる (列名は received_at)。再送で更新されるのは updatedAt の方。
   */
  readonly receivedAt: T["createdAt"];
  readonly updatedAt: T["updatedAt"];
}

/**
 * 受信した Webmention。
 *
 * 保存されているということは「source を取りに行って、target への実リンクを確かめた」
 * ということ。検証を通っていないものはこのエンティティにならない。
 *
 * 著者名・本文は VO の時点で HTML を落としたテキストになっているので、表示する側は
 * 素の文字列として扱ってよい。
 */
export class Webmention<T extends IPersisted | IUnpersisted = IPersisted> {
  private constructor(private readonly fields: WebmentionFields<T>) {}

  static create(params: {
    noteId: NoteId;
    target: NoteSlug;
    source: WebmentionUrl;
    type: WebmentionType;
    author: WebmentionAuthor;
    authorAvatar?: string;
    content?: WebmentionContent;
    publishedAt?: Temporal.Instant;
  }): Webmention<IUnpersisted> {
    return new Webmention({
      id: undefined,
      noteId: params.noteId,
      target: params.target,
      source: params.source,
      type: params.type,
      author: params.author,
      authorAvatar: params.authorAvatar,
      content: params.content,
      publishedAt: params.publishedAt,
      receivedAt: undefined,
      updatedAt: undefined,
    });
  }

  static reconstruct(params: {
    id: WebmentionId;
    noteId: NoteId;
    target: NoteSlug;
    source: WebmentionUrl;
    type: WebmentionType;
    author: WebmentionAuthor;
    authorAvatar: string | undefined;
    content: WebmentionContent | undefined;
    publishedAt: Temporal.Instant | undefined;
    receivedAt: Temporal.Instant;
    updatedAt: Temporal.Instant;
  }): Webmention {
    return new Webmention(params);
  }

  get id(): WebmentionFields<T>["id"] {
    return this.fields.id;
  }

  get noteId(): NoteId {
    return this.fields.noteId;
  }

  get target(): NoteSlug {
    return this.fields.target;
  }

  get source(): WebmentionUrl {
    return this.fields.source;
  }

  get type(): WebmentionType {
    return this.fields.type;
  }

  get author(): WebmentionAuthor {
    return this.fields.author;
  }

  get authorAvatar(): string | undefined {
    return this.fields.authorAvatar;
  }

  get content(): WebmentionContent | undefined {
    return this.fields.content;
  }

  get publishedAt(): Temporal.Instant | undefined {
    return this.fields.publishedAt;
  }

  get receivedAt(): WebmentionFields<T>["receivedAt"] {
    return this.fields.receivedAt;
  }

  get updatedAt(): WebmentionFields<T>["updatedAt"] {
    return this.fields.updatedAt;
  }
}
