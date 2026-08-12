import type { SessionId } from "./session-id.vo";
import type { Temporal } from "@js-temporal/polyfill";
import type { NoteSlug } from "~/backend/domain/note";

/**
 * セッションの寿命 (日)。
 *
 * ブラウザが cookie に許す上限が 400 日で、それを超えて指定しても切り詰められる。
 * 保存のたびに延ばすので、読み続けている限り切れない。cookie と KV で同じ値を使い、
 * 「ブラウザには残っているのに記録が無い」状態を作らない。
 */
export const SESSION_LIFETIME_DAYS = 400;

interface SessionFields {
  readonly id: SessionId;
  /** 発行した日 (UTC)。 */
  readonly startedOn: Temporal.PlainDate;
  /** 直近に閲覧を数えた日 (UTC)。まだ 1 件も数えていなければ undefined。 */
  readonly viewedOn: Temporal.PlainDate | undefined;
  /** viewedOn に数えたノート。日が変われば捨てる。 */
  readonly viewedNotes: readonly NoteSlug[];
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
    });
  }

  /** 保存済みのセッションを復元する。 */
  static reconstruct(params: {
    id: SessionId;
    startedOn: Temporal.PlainDate;
    viewedOn: Temporal.PlainDate | undefined;
    viewedNotes: readonly NoteSlug[];
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
}
