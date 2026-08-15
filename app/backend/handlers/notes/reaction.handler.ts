import { Hono } from "hono";
import { deleteReaction, putReaction } from "./reaction-recording";
import type { Context } from "hono";
import {
  InvalidNoteSlugError,
  NoteNotFoundError,
  NoteSlug,
} from "~/backend/domain/note";
import {
  InvalidReactionEmojiError,
  ReactionEmoji,
} from "~/backend/domain/note-reaction";
import { SessionId } from "~/backend/domain/session";
import {
  buildSessionCookie,
  readSessionId,
} from "~/backend/handlers/session-cookie";
import {
  D1NoteQueryRepository,
  D1NoteReactionQueryRepository,
} from "~/backend/infra/d1/repositories";
import { httpStatus } from "~/lib/constants/http-status";
import { createProblemResponse } from "~/lib/problem-details";

/** 応答の形。押されている数と、この読み手が押しているもの。 */
export interface ReactionsPayload {
  readonly reactions: readonly {
    readonly emoji: string;
    readonly count: number;
  }[];
  /** この読み手が押している絵文字。押していなければ null。 */
  readonly mine: string | null;
}

/** セッション識別子を預け直す cookie。 */
function sessionCookieFor(env: Env, sessionId: SessionId): string {
  return buildSessionCookie(sessionId, {
    // CSP と同じく development でだけ外す (dev は http で開くことがある)。
    secure: env.APP_ENV !== "development",
  });
}

function parseSlug(raw: string): NoteSlug | undefined {
  try {
    return NoteSlug.create(raw);
  } catch (error) {
    if (error instanceof InvalidNoteSlugError) return undefined;
    throw error;
  }
}

/**
 * 受け取った文字列を絵文字にする。読めなければ undefined。
 *
 * 一覧に無いものは弾く (fail-loud)。肌の色・髪の色を含むものはそもそも一覧に無いので、
 * ここで落ちる。「知らない絵文字は黙って既定に倒す」ようなことはしない。押した本人に
 * 見えている絵文字と、記録される絵文字が食い違うため。
 *
 * API (JSON) とページの action (フォーム) の両方から呼ぶ。入り口ごとに `create` を
 * 直に呼ぶと、片方だけ握り忘れて同じ入力の扱いが割れる (#253 がまさにそれで、ページ側は
 * 500 になっていた)。受け入れる集合と読めなかったときの形を、ここ 1 箇所に持たせる。
 */
export function parseReactionEmoji(raw: string): ReactionEmoji | undefined {
  try {
    return ReactionEmoji.create(raw);
  } catch (error) {
    if (error instanceof InvalidReactionEmojiError) return undefined;
    throw error;
  }
}

/** 本文から絵文字を取り出す。読めない・そもそも無いときは undefined。 */
async function readEmoji(request: Request): Promise<ReactionEmoji | undefined> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return undefined;
  }

  if (typeof body !== "object" || body === null) return undefined;
  const { emoji } = body as Record<string, unknown>;
  if (typeof emoji !== "string") return undefined;

  return parseReactionEmoji(emoji);
}

/** リアクションを置いた / 外した結果。記事が無いときは代わりに undefined が返る。 */
export interface ReactionOutcome {
  readonly payload: ReactionsPayload;
  /** セッション識別子を預け直す cookie の値。応答に載せること。 */
  readonly setCookie: string;
}

/**
 * リアクションを置く / 外す。
 *
 * API ルータ (JSON) とページの action (フォーム) の両方から呼ぶ。押した人の判定・
 * セッションの発行・数とスコアの更新はどちらでも同じなので、入り口の形だけを分ける。
 *
 * **記事が見つからないときは投げずに undefined を返す。** 投げると、Hono の外にいる
 * ページの action では onError に届かず ErrorBoundary のエラー画面 (500) になる
 * (#269)。どう応えるかは入り口ごとに違うので、判断はそちらに残す
 * (resolveDetail と同じ形)。
 *
 * @param emoji 押す絵文字。undefined なら取り消し。
 */
export async function applyReaction(
  env: Env,
  slugParam: string,
  emoji: ReactionEmoji | undefined,
  cookie: string | null,
): Promise<ReactionOutcome | undefined> {
  const slug = parseSlug(slugParam);
  if (slug === undefined) return undefined;

  const note = await new D1NoteQueryRepository(env.D1).findBySlug(slug);
  if (note === undefined) return undefined;

  const existingId = readSessionId(cookie);
  // 取り消しは、持っていない相手には効かせようがない。発行もしない。
  if (emoji === undefined && existingId === undefined) {
    return {
      payload: await buildPayload(env, note.id, undefined),
      setCookie: "",
    };
  }

  const sessionId = existingId ?? SessionId.issue();
  const session =
    emoji === undefined
      ? await deleteReaction(env, { id: note.id, slug }, sessionId)
      : await putReaction(env, { id: note.id, slug }, sessionId, emoji);

  return {
    payload: await buildPayload(env, note.id, session.reactionFor(slug)?.emoji),
    setCookie: sessionCookieFor(env, sessionId),
  };
}

/**
 * ノートのリアクション API。
 *
 * - PUT /:slug/reaction — `{ emoji }` を押す (すでに押していれば差し替え)
 * - DELETE /:slug/reaction — 取り消す
 *
 * 1 ノートにつき 1 人 1 つなので、「増やす」ではなく「いまの状態を置く」形にしてある。
 * 押した人はセッション (cookie → KV) で決まる。cookie を持っていなければその場で
 * 発行し、応答に載せる。
 */
export function createNoteReactionApiRouter(): Hono<{ Bindings: Env }> {
  const router = new Hono<{ Bindings: Env }>();

  router.put("/:slug/reaction", async (c) => {
    const emoji = await readEmoji(c.req.raw);
    if (emoji === undefined) {
      return createProblemResponse(
        httpStatus.BAD_REQUEST,
        "Bad Request",
        "emoji must be one of the supported reactions",
      );
    }

    return respond(c, await apply(c, c.req.param("slug"), emoji));
  });

  router.delete("/:slug/reaction", async (c) =>
    respond(c, await apply(c, c.req.param("slug"), undefined)),
  );

  return router;
}

/**
 * API から applyReaction を呼び、記事が無ければ 404 に落とす。
 *
 * ここで投げるのは Hono の中だからで、`app.onError` が Problem Details の 404 に
 * マップする (detail.handler の resolveDetail と同じ形)。
 */
async function apply(
  c: Context<{ Bindings: Env }>,
  slugParam: string,
  emoji: ReactionEmoji | undefined,
): Promise<ReactionOutcome> {
  const outcome = await applyReaction(
    c.env,
    slugParam,
    emoji,
    c.req.header("cookie") ?? null,
  );
  if (outcome === undefined) throw new NoteNotFoundError(slugParam);
  return outcome;
}

/**
 * 結果を JSON にして、セッションの cookie を載せる。
 *
 * cookie は応答のたびに出して期限を引き直す。押し続けている人のセッションが、ある日
 * 突然切れて別人にならないようにするため。
 */
function respond(
  c: Context<{ Bindings: Env }>,
  outcome: ReactionOutcome,
): Response {
  const response = c.json(outcome.payload);
  if (outcome.setCookie !== "") {
    response.headers.set("set-cookie", outcome.setCookie);
  }
  return response;
}

/** 押されている数と、この読み手が押しているものをまとめる。 */
export async function buildPayload(
  env: Env,
  noteId: string,
  mine: ReactionEmoji | undefined,
): Promise<ReactionsPayload> {
  const reactions = await new D1NoteReactionQueryRepository(
    env.D1,
  ).listByNoteId(noteId);
  return {
    reactions: reactions.map((reaction) => ({
      emoji: reaction.emoji,
      count: reaction.count,
    })),
    mine: mine?.toString() ?? null,
  };
}
