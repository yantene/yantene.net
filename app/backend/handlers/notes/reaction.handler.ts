import { Hono } from "hono";
import { deleteReaction, putReaction } from "./reaction-recording";
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
 * 本文から絵文字を取り出す。
 *
 * 一覧に無いものは弾く (fail-loud)。肌の色・髪の色を含むものはそもそも一覧に無いので、
 * ここで落ちる。「知らない絵文字は黙って既定に倒す」ようなことはしない。押した本人に
 * 見えている絵文字と、記録される絵文字が食い違うため。
 */
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

  try {
    return ReactionEmoji.create(emoji);
  } catch (error) {
    if (error instanceof InvalidReactionEmojiError) return undefined;
    throw error;
  }
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
    const slug = parseSlug(c.req.param("slug"));
    if (slug === undefined) throw new NoteNotFoundError(c.req.param("slug"));

    const emoji = await readEmoji(c.req.raw);
    if (emoji === undefined) {
      return createProblemResponse(
        httpStatus.BAD_REQUEST,
        "Bad Request",
        "emoji must be one of the supported reactions",
      );
    }

    const note = await new D1NoteQueryRepository(c.env.D1).findBySlug(slug);
    if (note === undefined) throw new NoteNotFoundError(slug.toString());

    const sessionId =
      readSessionId(c.req.header("cookie") ?? null) ?? SessionId.issue();
    const session = await putReaction(
      c.env,
      { id: note.id, slug },
      sessionId,
      emoji,
    );

    const response = c.json(
      await buildPayload(c.env, note.id, session.reactionFor(slug)?.emoji),
    );
    // 応答のたびに出して期限を引き直す。押し続けている人のセッションが、
    // ある日突然切れて別人にならないようにする。
    response.headers.set("set-cookie", sessionCookieFor(c.env, sessionId));
    return response;
  });

  router.delete("/:slug/reaction", async (c) => {
    const slug = parseSlug(c.req.param("slug"));
    if (slug === undefined) throw new NoteNotFoundError(c.req.param("slug"));

    const note = await new D1NoteQueryRepository(c.env.D1).findBySlug(slug);
    if (note === undefined) throw new NoteNotFoundError(slug.toString());

    const sessionId = readSessionId(c.req.header("cookie") ?? null);
    // 持っていない相手には取り消すものが無い。発行だけして、いまの数を返す。
    if (sessionId === undefined) {
      return c.json(await buildPayload(c.env, note.id, undefined));
    }

    const session = await deleteReaction(
      c.env,
      { id: note.id, slug },
      sessionId,
    );
    const response = c.json(
      await buildPayload(c.env, note.id, session.reactionFor(slug)?.emoji),
    );
    response.headers.set("set-cookie", sessionCookieFor(c.env, sessionId));
    return response;
  });

  return router;
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
