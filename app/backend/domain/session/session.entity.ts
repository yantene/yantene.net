import type { SessionId } from "./session-id.vo";
import type { Temporal } from "@js-temporal/polyfill";
import type { NoteSlug } from "~/backend/domain/note";
import type { ReactionEmoji } from "~/backend/domain/note-reaction";

/**
 * セッションの寿命 (日)。
 *
 * ブラウザが cookie に許す上限が 400 日で、それを超えて指定しても切り詰められる。
 * 保存のたびに延ばすので、読み続けている限り切れない。cookie と KV で同じ値を使い、
 * 「ブラウザには残っているのに記録が無い」状態を作らない。
 */
export const SESSION_LIFETIME_DAYS = 400;

/**
 * この人がノートに押したリアクション。
 *
 * 押した日を持つのは、取り消すときに「押したときに足したのと同じ重み」を引くため。
 * 今日の重みで引くと、日をまたいで押し消しするだけでスコアを削れてしまう。
 */
export interface SessionReaction {
  readonly slug: NoteSlug;
  readonly emoji: ReactionEmoji;
  readonly reactedOn: Temporal.PlainDate;
}

interface SessionFields {
  readonly id: SessionId;
  /** 発行した日 (UTC)。 */
  readonly startedOn: Temporal.PlainDate;
  /** 直近に閲覧を数えた日 (UTC)。まだ 1 件も数えていなければ undefined。 */
  readonly viewedOn: Temporal.PlainDate | undefined;
  /** viewedOn に数えたノート。日が変われば捨てる。 */
  readonly viewedNotes: readonly NoteSlug[];
  /**
   * 押したリアクション。1 ノートにつき 1 つ。
   *
   * 閲覧の記録と違って**日が変わっても捨てない**。捨てると、取り消しも差し替えも
   * できなくなり、同じ人が何度でも押せてしまう。閲覧のほうは「その日に数えたか」しか
   * 要らないので捨てられるが、こちらは押した状態そのものなので持ち続ける。
   */
  readonly reactions: readonly SessionReaction[];
}

/**
 * 読み手のセッション。サイトを訪れた人ひとりぶんの状態をまとめる集約。
 *
 * いま持っているのは「その日どのノートを数えたか」だけで、同じ日の読み直しを
 * 数えないために使う。
 *
 * 識別子は乱数で、名前も IP も持たない。それでも「同じブラウザから来た人」を辿れる
 * 値ではあるので、置くのは辿られて困らないものだけにすること。
 *
 * 永続化の状態 (IPersisted / IUnpersisted) では分けない。識別子は発行の時点で
 * 決まっており、保存の前後で持ち物が変わらないため。
 */
export class Session {
  private constructor(private readonly fields: SessionFields) {}

  /** 新しいセッションを起こす (まだ保存されていない)。 */
  static start(id: SessionId, on: Temporal.PlainDate): Session {
    return new Session({
      id,
      startedOn: on,
      viewedOn: undefined,
      viewedNotes: [],
      reactions: [],
    });
  }

  /** 保存済みのセッションを復元する。 */
  static reconstruct(params: {
    id: SessionId;
    startedOn: Temporal.PlainDate;
    viewedOn: Temporal.PlainDate | undefined;
    viewedNotes: readonly NoteSlug[];
    reactions: readonly SessionReaction[];
  }): Session {
    return new Session(params);
  }

  get id(): SessionId {
    return this.fields.id;
  }

  get startedOn(): Temporal.PlainDate {
    return this.fields.startedOn;
  }

  get viewedOn(): Temporal.PlainDate | undefined {
    return this.fields.viewedOn;
  }

  get viewedNotes(): readonly NoteSlug[] {
    return this.fields.viewedNotes;
  }

  /** その日にそのノートをすでに数えたか。 */
  hasViewed(slug: NoteSlug, on: Temporal.PlainDate): boolean {
    if (this.fields.viewedOn?.equals(on) !== true) return false;
    return this.fields.viewedNotes.some((viewed) => viewed.equals(slug));
  }

  /**
   * 数えたことを書き加えた新しいセッションを返す (非破壊)。
   *
   * 日が変わっていれば前日ぶんは捨てる。持ち回るのは「今日ぶん」だけでよく、
   * 溜め続けると読み手の閲覧履歴そのものになってしまう。
   */
  withView(slug: NoteSlug, on: Temporal.PlainDate): Session {
    if (this.hasViewed(slug, on)) return this;

    const isSameDay = this.fields.viewedOn?.equals(on) === true;
    return new Session({
      ...this.fields,
      viewedOn: on,
      viewedNotes: isSameDay ? [...this.fields.viewedNotes, slug] : [slug],
    });
  }

  get reactions(): readonly SessionReaction[] {
    return this.fields.reactions;
  }

  /** そのノートに押しているリアクション。押していなければ undefined。 */
  reactionFor(slug: NoteSlug): SessionReaction | undefined {
    return this.fields.reactions.find((reaction) => reaction.slug.equals(slug));
  }

  /**
   * リアクションを押した新しいセッションを返す (非破壊)。
   *
   * 1 ノートにつき 1 つなので、すでに押していれば差し替える。差し替えでは押した日を
   * 引き継ぐ。取り消すときに引く重みは最初に押した日で決まっており、押し直しで
   * 今日の日付に更新すると、押し直すだけでスコアを積める抜け道になる。
   */
  withReaction(
    slug: NoteSlug,
    emoji: ReactionEmoji,
    on: Temporal.PlainDate,
  ): Session {
    const existing = this.reactionFor(slug);
    const reaction: SessionReaction = {
      slug,
      emoji,
      reactedOn: existing?.reactedOn ?? on,
    };

    return new Session({
      ...this.fields,
      reactions: [
        ...this.fields.reactions.filter(
          (current) => !current.slug.equals(slug),
        ),
        reaction,
      ],
    });
  }

  /** リアクションを取り消した新しいセッションを返す (非破壊)。 */
  withoutReaction(slug: NoteSlug): Session {
    return new Session({
      ...this.fields,
      reactions: this.fields.reactions.filter(
        (reaction) => !reaction.slug.equals(slug),
      ),
    });
  }
}
