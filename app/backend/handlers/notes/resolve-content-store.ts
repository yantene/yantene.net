import type { IContentStore } from "~/backend/domain/content";
import { ArtifactsContentStore } from "~/backend/infra/artifacts/artifacts-content-store";
import { GitHubContentStore } from "~/backend/infra/github/github-content-store";

/**
 * Composition Root: env からコンテンツ正本の設定を解決して {@link IContentStore} を生成する。
 *
 * どちらの正本を読むかは wrangler.jsonc の var `CONTENT_SOURCE` で環境ごとに決める
 * (ADR 0031)。存在ベースのフォールバック (secret があれば有効) は採らず、値が無いか
 * 知らない値なら throw する (fail-loud)。
 *
 * - `artifacts`: Cloudflare Artifacts。namespace / repo / branch は vars
 *   (`ARTIFACTS_NAMESPACE` / `ARTIFACTS_REPO` / `ARTIFACTS_BRANCH`)、アカウント ID と
 *   API トークンは secret (`ARTIFACTS_ACCOUNT_ID` / `ARTIFACTS_API_TOKEN`)。
 * - `github`: GitHub リポジトリ。production を切り替えるまでの間だけ残す。owner / repo /
 *   branch は vars (`GITHUB_OWNER` / `GITHUB_REPO` / `GITHUB_BRANCH`)、トークンは
 *   secret (`GITHUB_TOKEN`)。
 */
export function resolveContentStore(env: Env): IContentStore {
  const source: string = env.CONTENT_SOURCE;
  switch (source) {
    case "artifacts":
      return resolveArtifacts(env);
    case "github":
      return resolveGitHub(env);
    default:
      throw new Error(
        `CONTENT_SOURCE must be "artifacts" or "github" to read content (got ${JSON.stringify(source)}).`,
      );
  }
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

function resolveGitHub(env: Env): IContentStore {
  const token = readSecret(env, "GITHUB_TOKEN");
  return new GitHubContentStore({
    owner: env.GITHUB_OWNER,
    repo: env.GITHUB_REPO,
    branch: env.GITHUB_BRANCH,
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
