import type { IContentStore } from "~/backend/domain/content";
import { ArtifactsContentStore } from "~/backend/infra/artifacts/artifacts-content-store";
import { LocalContentStore } from "~/backend/infra/local/local-content-store";

/**
 * Composition Root: env からコンテンツリポジトリの設定を解決して {@link IContentStore} を生成する。
 *
 * どのコンテンツリポジトリを読むかは wrangler.jsonc の var `CONTENT_SOURCE` で環境ごとに決める
 * (ADR 0034)。存在ベースのフォールバック (secret があれば有効) は採らず、値が無いか
 * 知らない値なら throw する (fail-loud)。
 *
 * - `artifacts`: Cloudflare Artifacts。namespace / repo / branch は vars
 *   (`ARTIFACTS_NAMESPACE` / `ARTIFACTS_REPO` / `ARTIFACTS_BRANCH`)、アカウント ID と
 *   API トークンは secret (`ARTIFACTS_ACCOUNT_ID` / `ARTIFACTS_API_TOKEN`)。
 * - `local`: 手元のコンテンツリポジトリの作業ツリー (ADR 0047)。`pnpm dev` の Vite が出す口を
 *   var `LOCAL_CONTENT_URL` で指す。development だけが使う。
 */
export function resolveContentStore(env: Env): IContentStore {
  // wrangler が生成する型は、いま設定してある値のリテラルに固まるので文字列として比べる。
  const source: string = env.CONTENT_SOURCE;
  if (source === "artifacts") return resolveArtifacts(env);
  if (source === "local") return resolveLocal(env);
  throw new Error(
    `CONTENT_SOURCE must be "artifacts" or "local" to read content (got ${JSON.stringify(source)}).`,
  );
}

function resolveLocal(env: Env): IContentStore {
  return new LocalContentStore({ baseUrl: readSecret(env, "LOCAL_CONTENT_URL") });
}

function resolveArtifacts(env: Env): IContentStore {
  const accountId = readSecret(env, "ARTIFACTS_ACCOUNT_ID");
  const token = readSecret(env, "ARTIFACTS_API_TOKEN");
  return new ArtifactsContentStore({
    accountId,
    namespace: env.ARTIFACTS_NAMESPACE,
    repo: env.ARTIFACTS_REPO,
    branch: env.ARTIFACTS_BRANCH,
    getAuthToken: () => Promise.resolve(token),
  });
}

/**
 * secret と、環境によって置いたり置かなかったりする var は wrangler の型に現れないので、
 * 名前で引いて空なら throw する (secure by default)。
 */
function readSecret(env: Env, name: string): string {
  const value = (env as unknown as Record<string, unknown>)[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${name} is required to read content from ${env.CONTENT_SOURCE}.`);
  }
  return value;
}
