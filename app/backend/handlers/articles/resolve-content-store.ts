import type { IContentStore } from "~/backend/domain/content";
import { ArtifactsContentStore } from "~/backend/infra/artifacts/artifacts-content-store";

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
 *
 * いま読める先は Artifacts だけだが、分岐は残してある。手元の作業ツリーを読む `local` を
 * 足す先 (#461) がここになる。
 */
export function resolveContentStore(env: Env): IContentStore {
  const source: string = env.CONTENT_SOURCE;
  if (source !== "artifacts") {
    throw new Error(
      `CONTENT_SOURCE must be "artifacts" to read content (got ${JSON.stringify(source)}).`,
    );
  }
  return resolveArtifacts(env);
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

/** secret は wrangler の型に現れないので、名前で引いて空なら throw する (secure by default)。 */
function readSecret(env: Env, name: string): string {
  const value = (env as unknown as Record<string, unknown>)[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${name} is required to read content from ${env.CONTENT_SOURCE}.`);
  }
  return value;
}
