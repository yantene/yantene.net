import type { IContentStore } from "~/backend/domain/content";
import { GitHubContentStore } from "~/backend/infra/github/github-content-store";

/**
 * Composition Root: env からコンテンツ正本 (GitHub リポジトリ) の設定を解決して
 * {@link IContentStore} を生成する。
 *
 * Cloudflare Artifacts (beta) がアカウントで未有効なため、当面は GitHub をコンテンツ
 * 正本として使う。Artifacts が有効化されたら {@link GitHubContentStore} を
 * `ArtifactsContentStore` に差し替えるだけでよい (IContentStore の抽象の利点)。
 *
 * - owner / repo / branch は wrangler.jsonc の vars (GITHUB_OWNER / GITHUB_REPO /
 *   GITHUB_BRANCH)。
 * - トークンは secret (`wrangler secret put GITHUB_TOKEN`)。未設定なら静かに
 *   フォールバックせず fail-loud で throw する (secure by default)。
 */
export function resolveContentStore(env: Env): IContentStore {
  const token = (env as unknown as { GITHUB_TOKEN?: unknown }).GITHUB_TOKEN;
  if (typeof token !== "string" || token.length === 0) {
    throw new Error(
      "GITHUB_TOKEN is required to read content from the GitHub repository.",
    );
  }

  return new GitHubContentStore({
    owner: env.GITHUB_OWNER,
    repo: env.GITHUB_REPO,
    branch: env.GITHUB_BRANCH,
    getAuthToken: () => Promise.resolve(token),
  });
}
