import { describe, expect, it } from "vitest";
import { resolveContentStore } from "./resolve-content-store";
import { ArtifactsContentStore } from "~/backend/infra/artifacts/artifacts-content-store";
import { GitHubContentStore } from "~/backend/infra/github/github-content-store";

const VARS = {
  ARTIFACTS_NAMESPACE: "yantene",
  ARTIFACTS_REPO: "notes",
  ARTIFACTS_BRANCH: "main",
  GITHUB_OWNER: "yantene",
  GITHUB_REPO: "notes",
  GITHUB_BRANCH: "main",
};

function env(overrides: Record<string, unknown>): Env {
  return { ...VARS, ...overrides } as unknown as Env;
}

describe("resolveContentStore", () => {
  it("builds the Artifacts store when CONTENT_SOURCE is artifacts", () => {
    const store = resolveContentStore(
      env({
        CONTENT_SOURCE: "artifacts",
        ARTIFACTS_ACCOUNT_ID: "acct",
        ARTIFACTS_API_TOKEN: "tok",
      }),
    );
    expect(store).toBeInstanceOf(ArtifactsContentStore);
  });

  it("builds the GitHub store when CONTENT_SOURCE is github", () => {
    const store = resolveContentStore(env({ CONTENT_SOURCE: "github", GITHUB_TOKEN: "ghp" }));
    expect(store).toBeInstanceOf(GitHubContentStore);
  });

  it("throws (fail-loud) when a secret for the chosen source is missing", () => {
    // secret があれば有効・無ければ無言、という存在ベースの切り替えはしない。
    expect(() =>
      resolveContentStore(env({ CONTENT_SOURCE: "artifacts", ARTIFACTS_API_TOKEN: "tok" })),
    ).toThrow(/ARTIFACTS_ACCOUNT_ID/);
    expect(() =>
      resolveContentStore(env({ CONTENT_SOURCE: "artifacts", ARTIFACTS_ACCOUNT_ID: "acct" })),
    ).toThrow(/ARTIFACTS_API_TOKEN/);
    expect(() => resolveContentStore(env({ CONTENT_SOURCE: "github" }))).toThrow(/GITHUB_TOKEN/);
  });

  it("throws (fail-loud) when CONTENT_SOURCE is missing or unknown", () => {
    expect(() => resolveContentStore(env({ GITHUB_TOKEN: "ghp" }))).toThrow(/CONTENT_SOURCE/);
    expect(() => resolveContentStore(env({ CONTENT_SOURCE: "r2", GITHUB_TOKEN: "ghp" }))).toThrow(
      /CONTENT_SOURCE/,
    );
  });
});
