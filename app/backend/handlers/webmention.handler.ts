import { Hono } from "hono";
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
import { HttpWebmentionSourceFetcher } from "~/backend/infra/http/http-webmention-source-fetcher";
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

  router.post(WEBMENTION_PATH, async (c) => {
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
        logger,
      );
      c.executionCtx.waitUntil(service.verify(note.id, request));
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

/** フォームとして読む。読めなければ undefined (本文が壊れている / 形式が違う)。 */
async function readForm(request: Request): Promise<FormData | undefined> {
  try {
    return await request.formData();
  } catch {
    return undefined;
  }
}
