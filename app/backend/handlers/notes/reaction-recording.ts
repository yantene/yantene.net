import { Temporal } from "@js-temporal/polyfill";
import type { NoteSlug } from "~/backend/domain/note";
import type { ReactionEmoji } from "~/backend/domain/note-reaction";
import type { Session, SessionId } from "~/backend/domain/session";
import {
  logScoreAfterReaction,
  logScoreAfterReactionRemoved,
  viewWeightLog,
} from "~/backend/domain/note-view";
import { Session as SessionEntity } from "~/backend/domain/session";
import { D1NoteReactionCommandRepository } from "~/backend/infra/d1/repositories";
import {
  KvSessionCommandRepository,
  KvSessionQueryRepository,
} from "~/backend/infra/kv/repositories";

/** リアクションを付け外しするノート。数を動かすのに id が、セッションの照合に slug が要る。 */
export interface ReactedNoteRef {
  readonly id: string;
  readonly slug: NoteSlug;
}

/**
 * セッションを引く。無ければその場で起こす。
 *
 * 閲覧の記録と違い、リアクションは応答を返す前に確定させる。押した結果をその場で
 * 返さないと、画面が「押せたのかどうか」を推測で描くことになるため。
 */
async function loadSession(
  env: Env,
  sessionId: SessionId,
  today: Temporal.PlainDate,
): Promise<Session> {
  return (
    (await new KvSessionQueryRepository(env.SESSIONS).findById(sessionId)) ??
    SessionEntity.start(sessionId, today)
  );
}

/**
 * リアクションを付ける (すでに押していれば差し替える)。
 *
 * 数は「旧を減らして新を増やす」。スコアは初めて押したときだけ足し、差し替えでは
 * 動かさない。リアクションしている事実自体は続いているためで、ここで今日の重みに
 * 付け替えると、押し直すだけでスコアを積める抜け道になる。
 *
 * @returns 保存後のセッション。押している絵文字を呼び出し側が返せるようにする。
 */
export async function putReaction(
  env: Env,
  note: ReactedNoteRef,
  sessionId: SessionId,
  emoji: ReactionEmoji,
): Promise<Session> {
  const today = Temporal.Now.plainDateISO("UTC");
  const session = await loadSession(env, sessionId, today);
  const existing = session.reactionFor(note.slug);

  // 同じ絵文字を押し直しても何も起きない (取り消しは別の入り口が持つ)。
  if (existing?.emoji.equals(emoji) === true) return session;

  const reactions = new D1NoteReactionCommandRepository(env.D1);
  const next = session.withReaction(note.slug, emoji, today);

  // 先にセッションを書く。途中で落ちたときに、数だけ動いて押した本人が
  // 取り消せない状態になるのを避ける。
  await new KvSessionCommandRepository(env.SESSIONS).save(next);

  if (existing !== undefined) {
    await reactions.decrement(note.id, existing.emoji);
  }
  await reactions.increment(note.id, emoji);

  if (existing === undefined) {
    await applyReactionScore(reactions, note.id, today.toString());
  }

  return next;
}

/**
 * リアクションを取り消す。
 *
 * 引くのは「押した日の重み」。今日の重みで引くと、日をまたいで押し消しするだけで
 * スコアを削れてしまう。押した日はセッションが覚えている。
 */
export async function deleteReaction(
  env: Env,
  note: ReactedNoteRef,
  sessionId: SessionId,
): Promise<Session> {
  const today = Temporal.Now.plainDateISO("UTC");
  const session = await loadSession(env, sessionId, today);
  const existing = session.reactionFor(note.slug);
  if (existing === undefined) return session;

  const reactions = new D1NoteReactionCommandRepository(env.D1);
  const next = session.withoutReaction(note.slug);

  await new KvSessionCommandRepository(env.SESSIONS).save(next);
  await reactions.decrement(note.id, existing.emoji);
  await removeReactionScore(reactions, note.id, existing.reactedOn.toString());

  return next;
}

/** いまのスコアを読み、リアクションぶんを足して書き戻す。 */
async function applyReactionScore(
  reactions: D1NoteReactionCommandRepository,
  noteId: string,
  reactedOn: string,
): Promise<void> {
  const current = await reactions.findLogScore(noteId);
  // 記事が無ければ何もしない (0 は「まだ読まれていない」なので記録する)。
  if (current === undefined) return;

  await reactions.applyLogScore(
    noteId,
    logScoreAfterReaction(current, reactedOn),
  );
}

/**
 * いまのスコアから、押したときに足したのと同じ重みを引いて書き戻す。
 *
 * 下限にはその記事の出発点 (投稿日の重み) を渡す。まだ読まれていない古い記事では、
 * リアクションを足した時点で出発点が丸めで消えており、素直に引くと引ききってしまう。
 */
async function removeReactionScore(
  reactions: D1NoteReactionCommandRepository,
  noteId: string,
  reactedOn: string,
): Promise<void> {
  const context = await reactions.findScoreContext(noteId);
  if (context === undefined) return;

  await reactions.applyLogScore(
    noteId,
    logScoreAfterReactionRemoved(
      context.logScore,
      reactedOn,
      viewWeightLog(context.publishedOn),
    ),
  );
}
