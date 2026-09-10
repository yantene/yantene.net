import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { runRefresh } from "./run-refresh";

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
 * 記事の同期 (refresh) の JSON API ルータ。
 *
 * 認証はユーザ session ではなく運用シークレット (`REFRESH_SECRET`) で行う。コンテンツ
 * 同期は CI/運用操作であり、人が手で叩くため。
 *
 * **通常の同期はコンテンツリポジトリへの push で自動的に走る** (`refresh-queue.handler.ts`)。ここが
 * 残っているのは、実装を変えたときに既存の記事へ反映させる `?force=true` の口としてで、
 * 「全部やり直せ」を意味する push は存在しないため。
 *
 * - `REFRESH_SECRET` 未設定なら静かに無効化せず fail-loud で throw する (secure by default)。
 * - `X-Refresh-Token` ヘッダが一致しなければ 401。
 * - `POST /refresh` → コンテンツリポジトリを D1 + R2 に同期し、処理結果サマリを返す。
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

    // ?force=true でコンテンツ未変更の記事も再処理する (実装変更の反映用)。
    return c.json(await runRefresh(c.env, { force: c.req.query("force") === "true" }));
  });

  return router;
}
