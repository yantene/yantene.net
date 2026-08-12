import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { NoteId } from "~/backend/domain/note";
import type { ILogger } from "~/backend/domain/shared";
import { errorToContext } from "~/backend/domain/shared";
import {
  TargetNoteNotFoundError,
  WebmentionRejectedError,
  WebmentionRequest,
} from "~/backend/domain/webmention";
import { ConsoleLogger } from "~/backend/infra/console/console-logger";
import {
  D1NoteQueryRepository,
  D1WebmentionCommandRepository,
} from "~/backend/infra/d1/repositories";
import { HttpWebmentionAvatarMirror } from "~/backend/infra/http/http-webmention-avatar-mirror";
import { HttpWebmentionSourceFetcher } from "~/backend/infra/http/http-webmention-source-fetcher";
import { R2WebmentionAvatarCache } from "~/backend/infra/r2/r2-webmention-avatar-cache";
import { WebmentionVerificationService } from "~/backend/services/webmention-verification.service";
import { httpStatus } from "~/lib/constants/http-status";
import { WEBMENTION_PATH } from "~/lib/constants/webmention";
import { createProblemResponse } from "~/lib/problem-details";

/**
 * Webmention の受け口 (W3C Webmention)。
 *
 * `POST /webmention` に `application/x-www-form-urlencoded` の `source` / `target` が
 * 届く。送り手を待たせないため、同期でやるのは形式の検証だけにして 202 を返し、
 * 「source を実際に読んで target へのリンクを確かめる」ところは `waitUntil` に逃がす。
 *
 * 同期段で 400 にするのは、送り手に直してもらう余地があるものだけ。
 *
 * - source / target が無い・URL でない・http/https でない
 * - source と target が同じ
 * - target がこのサイトのノート URL (`/notes/<slug>`) でない
 * - target のノートが存在しない
 * - source がこのサイト自身 (self-mention は受けない)
 *
 * staging では BASIC 認証の内側に居るため外から叩けないが、それでよい。認証を回避する
 * 例外をここに開けない (staging に外部から届く必要は無く、穴の方が高くつく)。
 */
export function createWebmentionRouter(): Hono<{ Bindings: Env }> {
  const router = new Hono<{ Bindings: Env }>();

  router.post(WEBMENTION_PATH, limitBody, async (c) => {
    const form = await readForm(c.req.raw);
    if (form === undefined) {
      return createProblemResponse(
        httpStatus.BAD_REQUEST,
        "Bad Request",
        "expected an application/x-www-form-urlencoded body",
      );
    }

    const logger = new ConsoleLogger({ handler: "webmention" });

    try {
      const request = WebmentionRequest.create({
        source: form.get("source"),
        target: form.get("target"),
        siteOrigin: new URL(c.req.url).origin,
      });

      const note = await new D1NoteQueryRepository(c.env.D1).findBySlug(
        request.targetSlug,
      );
      if (note === undefined) {
        throw new TargetNoteNotFoundError(
          `target note does not exist: ${request.targetSlug.toString()}`,
        );
      }

      const service = new WebmentionVerificationService(
        new HttpWebmentionSourceFetcher(logger),
        new D1WebmentionCommandRepository(c.env.D1),
        new HttpWebmentionAvatarMirror(
          new R2WebmentionAvatarCache(c.env.R2),
          logger,
        ),
        logger,
      );
      c.executionCtx.waitUntil(verifyAndLog(service, note.id, request, logger));
    } catch (error) {
      if (error instanceof WebmentionRejectedError) {
        return createProblemResponse(
          httpStatus.BAD_REQUEST,
          "Bad Request",
          error.message,
        );
      }
      throw error;
    }

    // 受け取ったことだけを返す。検証の結果は送り手には返らない (仕様どおり)。
    return c.body(null, httpStatus.ACCEPTED);
  });

  return router;
}

/**
 * 受け取る本文の上限。
 *
 * 中身は URL 2 本だけなので、これで足りる。誰でも叩ける口なので、読み込む前に頭を
 * 押さえる (`formData()` は渡されただけ読んでしまう)。
 */
const MAX_BODY_BYTES = 4096;

const limitBody = bodyLimit({
  maxSize: MAX_BODY_BYTES,
  onError: () =>
    createProblemResponse(
      httpStatus.PAYLOAD_TOO_LARGE,
      "Payload Too Large",
      "source and target are all this endpoint accepts",
    ),
});

/**
 * 検証を回し、落ちたらログに残して終える。
 *
 * 202 を返したあとに起きた失敗 (D1 の書き込みなど) は、もう応答に載せられない。握り
 * つぶすと何も残らないので、error として吐く。取りに行けなかったこと自体は fetcher が
 * info として扱っており、ここに来るのはこちら側の不具合だけ。
 */
async function verifyAndLog(
  service: WebmentionVerificationService,
  noteId: NoteId,
  request: WebmentionRequest,
  logger: ILogger,
): Promise<void> {
  try {
    await service.verify(noteId, request);
  } catch (error) {
    logger.error("webmention verification failed", {
      source: request.source.toString(),
      target: request.target.toString(),
      ...errorToContext(error),
    });
  }
}

/** フォームとして読む。読めなければ undefined (本文が壊れている / 形式が違う)。 */
async function readForm(request: Request): Promise<FormData | undefined> {
  try {
    return await request.formData();
  } catch {
    return undefined;
  }
}
