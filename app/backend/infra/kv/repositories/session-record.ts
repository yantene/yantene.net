import { Temporal } from "@js-temporal/polyfill";
import type { SessionId, SessionReaction } from "~/backend/domain/session";
import { NoteSlug } from "~/backend/domain/note";
import { ReactionEmoji } from "~/backend/domain/note-reaction";
import { Session } from "~/backend/domain/session";

/** KV に置く形。JSON にできる値だけで持つ。 */
export interface SessionRecord {
  readonly startedOn: string;
  readonly viewedOn?: string;
  readonly viewedNotes?: readonly string[];
  readonly reactions?: readonly SessionReactionRecord[];
}

/** 押したリアクション 1 件ぶん。 */
export interface SessionReactionRecord {
  readonly slug: string;
  readonly emoji: string;
  readonly reactedOn: string;
}

/** セッションを引くキー。名前空間はセッション専用なので接頭辞だけで足りる。 */
export function sessionKey(id: SessionId): string {
  return `session:${id.toString()}`;
}

export function sessionToRecord(session: Session): SessionRecord {
  return {
    startedOn: session.startedOn.toString(),
    ...(session.viewedOn !== undefined && {
      viewedOn: session.viewedOn.toString(),
    }),
    viewedNotes: session.viewedNotes.map((slug) => slug.toString()),
    reactions: session.reactions.map((reaction) => ({
      slug: reaction.slug.toString(),
      emoji: reaction.emoji.toString(),
      reactedOn: reaction.reactedOn.toString(),
    })),
  };
}

/**
 * KV から読んだ値を Session に戻す。読めない形なら undefined。
 *
 * ここに入るのは自分たちが書いた形だけなので、読めないのは記録が壊れたときか、
 * 形を変えた直後のどちらか。そのまま throw すると、その読み手は記録が期限切れに
 * なるまで (400 日) 何も数えられなくなる。undefined を返して呼び出し側に
 * 「起こし直し」をさせれば、次の保存で同じ識別子のまま上書きされて直る。
 */
export function recordToSession(
  id: SessionId,
  value: unknown,
): Session | undefined {
  if (typeof value !== "object" || value === null) return undefined;

  const { startedOn, viewedOn, viewedNotes, reactions } = value as Record<
    string,
    unknown
  >;
  if (typeof startedOn !== "string") return undefined;

  try {
    return Session.reconstruct({
      id,
      startedOn: Temporal.PlainDate.from(startedOn),
      viewedOn:
        typeof viewedOn === "string"
          ? Temporal.PlainDate.from(viewedOn)
          : undefined,
      viewedNotes: toSlugs(viewedNotes),
      reactions: toReactions(reactions),
    });
  } catch {
    return undefined;
  }
}

/**
 * 記録の中のリアクションを VO に戻す。
 *
 * slug と同じく、ひとつでも読めなければ throw して記録ごと捨てさせる。絵文字は
 * 一覧から外れたものが読めなくなる (Unicode の版を上げて減ることは無いが、こちらの
 * 除外の方針を変えれば起こりうる)。そのときはセッションごと作り直しになる。
 */
function toReactions(value: unknown): readonly SessionReaction[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new TypeError("reactions must be an array");
  }

  return value.map((entry: unknown) => {
    if (typeof entry !== "object" || entry === null) {
      throw new TypeError("reactions must contain objects");
    }
    const { slug, emoji, reactedOn } = entry as Record<string, unknown>;
    if (
      typeof slug !== "string" ||
      typeof emoji !== "string" ||
      typeof reactedOn !== "string"
    ) {
      throw new TypeError("reaction fields must be strings");
    }

    return {
      slug: NoteSlug.create(slug),
      emoji: ReactionEmoji.create(emoji),
      reactedOn: Temporal.PlainDate.from(reactedOn),
    };
  });
}

/**
 * 記録の中の slug を VO に戻す。
 *
 * ひとつでも読めなければ throw して、記録ごと捨てさせる。読めた要素だけ拾うと、
 * 壊れた記録が「一部だけ正しいもの」として生き残り、次の保存で書き戻されてしまう。
 */
function toSlugs(value: unknown): readonly NoteSlug[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new TypeError("viewedNotes must be an array");
  }

  return value.map((slug: unknown) => {
    if (typeof slug !== "string") {
      throw new TypeError("viewedNotes must contain strings");
    }
    return NoteSlug.create(slug);
  });
}
