import type { IContentStore } from "~/backend/domain/content";
import { ArtifactsContentStore } from "~/backend/infra/artifacts/artifacts-content-store";

/**
 * Composition Root: env から Artifacts の設定を解決して {@link IContentStore} を生成する。
 *
 * - namespace / repo / branch は wrangler.jsonc の vars。
 * - accountId は secret (`wrangler secret put ARTIFACTS_ACCOUNT_ID`)。未設定なら
 *   静かにフォールバックせず fail-loud で throw する (secure by default)。
 * - read トークンは Artifacts binding でリポジトリスコープに発行し、Bearer に載せる。
 */
export function resolveContentStore(env: Env): IContentStore {
  const accountId = (env as unknown as { ARTIFACTS_ACCOUNT_ID?: unknown })
    .ARTIFACTS_ACCOUNT_ID;
  if (typeof accountId !== "string" || accountId.length === 0) {
    throw new Error(
      "ARTIFACTS_ACCOUNT_ID is required to read content from Artifacts.",
    );
  }

  const repo = env.ARTIFACTS_REPO;

  return new ArtifactsContentStore({
    accountId,
    namespace: env.ARTIFACTS_NAMESPACE,
    repo,
    branch: env.ARTIFACTS_BRANCH,
    getAuthToken: async () => {
      const handle = await env.ARTIFACTS.get(repo);
      const token = await handle.createToken("read");
      return token.plaintext;
    },
  });
}
