import { describe, expect, it } from "vitest";
import { resolveContentStore } from "./resolve-content-store";
import { ArtifactsContentStore } from "~/backend/infra/artifacts/artifacts-content-store";

const VARS = {
  ARTIFACTS_NAMESPACE: "yantene",
  ARTIFACTS_REPO: "yantene-staging",
  ARTIFACTS_BRANCH: "main",
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

  it("throws (fail-loud) when a secret for the chosen source is missing", () => {
    // secret があれば有効・無ければ無言、という存在ベースの切り替えはしない。
    expect(() =>
      resolveContentStore(env({ CONTENT_SOURCE: "artifacts", ARTIFACTS_API_TOKEN: "tok" })),
    ).toThrow(/ARTIFACTS_ACCOUNT_ID/);
    expect(() =>
      resolveContentStore(env({ CONTENT_SOURCE: "artifacts", ARTIFACTS_ACCOUNT_ID: "acct" })),
    ).toThrow(/ARTIFACTS_API_TOKEN/);
  });

  it("throws (fail-loud) when CONTENT_SOURCE is missing or unknown", () => {
    expect(() => resolveContentStore(env({}))).toThrow(/CONTENT_SOURCE/);
    expect(() => resolveContentStore(env({ CONTENT_SOURCE: "r2" }))).toThrow(/CONTENT_SOURCE/);
    // 読まなくなった値も、黙って素通りさせずに throw する。
    expect(() => resolveContentStore(env({ CONTENT_SOURCE: "github" }))).toThrow(/CONTENT_SOURCE/);
  });
});
