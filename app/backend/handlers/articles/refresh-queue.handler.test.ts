import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleRefreshQueue } from "./refresh-queue.handler";
import { runRefresh } from "./run-refresh";

vi.mock("./run-refresh", () => ({ runRefresh: vi.fn(() => Promise.resolve({ processed: [] })) }));

const runRefreshMock = vi.mocked(runRefresh);

function env(overrides: Record<string, unknown> = {}): Env {
  return {
    CONTENT_SOURCE: "artifacts",
    ARTIFACTS_NAMESPACE: "yantene",
    ARTIFACTS_REPO: "yantene-staging",
    ARTIFACTS_BRANCH: "main",
    ...overrides,
  } as unknown as Env;
}

function pushEvent(ref: string, source?: { namespace: string; repoName: string }): unknown {
  return {
    type: "cf.artifacts.repo.pushed",
    source: {
      type: "artifacts.repo",
      ...(source ?? { namespace: "yantene", repoName: "yantene-staging" }),
    },
    payload: { ref, before: "a".repeat(40) },
  };
}

function batch(bodies: readonly unknown[]): {
  batch: MessageBatch;
  ackAll: ReturnType<typeof vi.fn>;
} {
  const ackAll = vi.fn();
  return {
    ackAll,
    batch: {
      queue: "yantene-staging-content-events",
      messages: bodies.map((body) => ({ body })),
      ackAll,
      retryAll: vi.fn(),
    } as unknown as MessageBatch,
  };
}

describe("handleRefreshQueue", () => {
  beforeEach(() => {
    runRefreshMock.mockClear();
  });

  it("syncs once for a push to the branch it reads", async () => {
    const { batch: b, ackAll } = batch([pushEvent("refs/heads/main")]);

    await handleRefreshQueue(b, env());

    expect(runRefreshMock).toHaveBeenCalledTimes(1);
    expect(runRefreshMock).toHaveBeenCalledWith(expect.anything(), { force: false });
    expect(ackAll).toHaveBeenCalled();
  });

  /*
   * 立て続けの push は 1 回の同期にまとまる。refresh はコミットを 1 つずつ辿るのではなく
   * 「コンテンツリポジトリのいまの姿」に揃える処理なので、まとめても取りこぼさない。
   */
  it("syncs only once for a batch of pushes", async () => {
    const { batch: b } = batch([
      pushEvent("refs/heads/main"),
      pushEvent("refs/heads/main"),
      pushEvent("refs/heads/main"),
    ]);

    await handleRefreshQueue(b, env());

    expect(runRefreshMock).toHaveBeenCalledTimes(1);
  });

  it("ignores pushes to other branches", async () => {
    const { batch: b, ackAll } = batch([pushEvent("refs/heads/draft")]);

    await handleRefreshQueue(b, env());

    expect(runRefreshMock).not.toHaveBeenCalled();
    expect(ackAll).toHaveBeenCalled();
  });

  /* 購読をアカウント単位で張ると、別のリポジトリへの push もここへ来る。 */
  it("ignores pushes to another repository", async () => {
    const { batch: b } = batch([
      pushEvent("refs/heads/main", { namespace: "yantene", repoName: "something-else" }),
    ]);

    await handleRefreshQueue(b, env());

    expect(runRefreshMock).not.toHaveBeenCalled();
  });

  it("ignores events of other types", async () => {
    const { batch: b } = batch([{ type: "cf.artifacts.repo.created", payload: {} }]);

    await handleRefreshQueue(b, env());

    expect(runRefreshMock).not.toHaveBeenCalled();
  });

  /* Artifacts を読んでいない環境で走らせると、push を合図に GitHub の中身を同期してしまう。 */
  it("does nothing when the content source is not artifacts", async () => {
    const { batch: b, ackAll } = batch([pushEvent("refs/heads/main")]);

    await handleRefreshQueue(b, env({ CONTENT_SOURCE: "github" }));

    expect(runRefreshMock).not.toHaveBeenCalled();
    expect(ackAll).toHaveBeenCalled();
  });

  /* 落ちたら ack せずに投げ返す。Queue が再試行する。 */
  it("lets the failure propagate so the queue retries", async () => {
    runRefreshMock.mockRejectedValueOnce(new Error("boom"));
    const { batch: b, ackAll } = batch([pushEvent("refs/heads/main")]);

    await expect(handleRefreshQueue(b, env())).rejects.toThrow("boom");
    expect(ackAll).not.toHaveBeenCalled();
  });
});
