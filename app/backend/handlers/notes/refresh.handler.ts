import { Temporal } from "@js-temporal/polyfill";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { resolveContentStore } from "./resolve-content-store";
import { ConsoleLogger } from "~/backend/infra/console/console-logger";
import {
  D1LinkCardCommandRepository,
  D1LinkCardQueryRepository,
  D1NoteCommandRepository,
  D1NoteEmbeddingCommandRepository,
  D1NoteEmbeddingQueryRepository,
  D1NoteQueryRepository,
  D1NoteSearchIndex,
} from "~/backend/infra/d1/repositories";
import { WorkersAiEmbeddingGenerator } from "~/backend/infra/ai/workers-ai-embedding-generator";
import { OgpLinkCardFetcher } from "~/backend/infra/http/ogp-link-card-fetcher";
import { R2LinkCardAssetCache } from "~/backend/infra/r2/r2-link-card-asset-cache";
import { R2NoteContentCache } from "~/backend/infra/r2/r2-note-content-cache";
import { LinkCardsRefreshService } from "~/backend/services/link-cards-refresh.service";
import { NoteEmbeddingsRefreshService } from "~/backend/services/note-embeddings-refresh.service";
import { NotesRefreshService } from "~/backend/services/notes-refresh.service";

/** シークレットを載せるヘッダ。staging の BASIC 認証 (Authorization) と衝突しないよう専用ヘッダにする。 */
const REFRESH_TOKEN_HEADER = "X-Refresh-Token";

/** 定数時間で文字列を比較する (タイミング攻撃対策)。 */
function isEqualConstantTime(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= (a.codePointAt(i) ?? 0) ^ (b.codePointAt(i) ?? 0);
  }
  return diff === 0;
}

/**
 * ノート同期 (refresh) の JSON API ルータ。
 *
 * 認証はユーザ session ではなく運用シークレット (`REFRESH_SECRET`) で行う。コンテンツ
 * 同期は CI/運用操作であり、`yantene/notes` への push を契機に叩かれるため。
 *
 * - `REFRESH_SECRET` 未設定なら静かに無効化せず fail-loud で throw する (secure by default)。
 * - `X-Refresh-Token` ヘッダが一致しなければ 401。
 * - `POST /refresh` → コンテンツ正本を D1 + R2 に同期し、処理結果サマリを返す。
 */
export function createRefreshRouter(): Hono<{ Bindings: Env }> {
  const router = new Hono<{ Bindings: Env }>();

  router.post("/refresh", async (c) => {
    const secret = (c.env as unknown as { REFRESH_SECRET?: unknown }).REFRESH_SECRET;
    if (typeof secret !== "string" || secret.length === 0) {
      throw new Error("REFRESH_SECRET is required to trigger a refresh.");
    }

    const provided = c.req.header(REFRESH_TOKEN_HEADER);
    if (provided === undefined || !isEqualConstantTime(provided, secret)) {
      throw new HTTPException(401, { message: "Invalid refresh token." });
    }

    const service = new NotesRefreshService(
      resolveContentStore(c.env),
      new D1NoteCommandRepository(c.env.D1),
      new D1NoteQueryRepository(c.env.D1),
      new R2NoteContentCache(c.env.R2),
      new D1NoteSearchIndex(c.env.D1),
    );
    // ?force=true でコンテンツ未変更のノートも再処理する (実装変更の反映用)。
    const isForce = c.req.query("force") === "true";
    const result = await service.refresh({ force: isForce });

    // 本文に貼られた URL のカードを揃える。ノートの同期とは失敗の扱いが違う
    // (外部サイトが落ちていることは異常ではない) ので、別のサービスに分けている。
    const logger = new ConsoleLogger({ component: "link-cards" });
    const linkCards = await new LinkCardsRefreshService(
      new OgpLinkCardFetcher(logger),
      new D1LinkCardCommandRepository(c.env.D1),
      new D1LinkCardQueryRepository(c.env.D1),
      new R2LinkCardAssetCache(c.env.R2),
      logger,
    ).sync(result.linkedUrls, Temporal.Now.instant(), { force: isForce });

    /*
     * 記事のベクトルと、記事どうしの近さを揃える。ここもノートの同期とは失敗の扱いが
     * 違う (外部のモデルに触るので落ちることがある) ので別のサービスに分けている。
     * 作れなかった記事は前回のベクトルと近さがそのまま残り、関連ノートは前の並びで出る。
     */
    const embeddings = await new NoteEmbeddingsRefreshService(
      new WorkersAiEmbeddingGenerator(c.env.AI),
      new D1NoteEmbeddingCommandRepository(c.env.D1),
      new D1NoteEmbeddingQueryRepository(c.env.D1),
      new D1NoteQueryRepository(c.env.D1),
      new R2NoteContentCache(c.env.R2),
      new ConsoleLogger({ component: "note-embeddings" }),
    ).sync({ force: isForce });

    return c.json({ ...result, linkCards, embeddings });
  });

  return router;
}
