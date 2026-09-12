import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleRefreshDeadLetter } from "./refresh-dead-letter.handler";

function env(): Env {
  return {
    ARTIFACTS_NAMESPACE: "yantene",
    ARTIFACTS_REPO: "yantene-staging",
    ARTIFACTS_BRANCH: "main",
  } as unknown as Env;
}

function batch(bodies: readonly unknown[]): {
  batch: MessageBatch;
  ackAll: ReturnType<typeof vi.fn>;
} {
  const ackAll = vi.fn();
  return {
    ackAll,
    batch: {
      queue: "yantene-staging-content-events-dlq",
      messages: bodies.map((body) => ({ body })),
      ackAll,
      retryAll: vi.fn(),
    } as unknown as MessageBatch,
  };
}

/** ConsoleLogger が出す 1 行 (JSON) を読む。 */
function loggedError(spy: ReturnType<typeof vi.spyOn>): Record<string, unknown> {
  expect(spy).toHaveBeenCalledTimes(1);
  return JSON.parse(String(spy.mock.calls[0]?.[0])) as Record<string, unknown>;
}

describe("handleRefreshDeadLetter", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  /* 気づく手立てはこの記録だけなので、どの push を取りこぼしたかまで残す。 */
  it("records the messages it gave up on", () => {
    const { batch: b } = batch([{ type: "cf.artifacts.repo.pushed", payload: { ref: "x" } }]);

    handleRefreshDeadLetter(b, env());

    const logged = loggedError(errorSpy);
    expect(logged.component).toBe("refresh-dead-letter");
    expect(logged.queue).toBe("yantene-staging-content-events-dlq");
    expect(logged.messages).toBe(1);
    expect(logged.repo).toBe("yantene/yantene-staging");
    expect((logged.bodies as string[])[0]).toContain("cf.artifacts.repo.pushed");
  });

  /* ack しないと滞留するだけで誰も見ない。同期のやり直しもしない。 */
  it("acks so the message does not linger", () => {
    const { batch: b, ackAll } = batch([{}, {}]);

    handleRefreshDeadLetter(b, env());

    expect(ackAll).toHaveBeenCalled();
    expect(loggedError(errorSpy).messages).toBe(2);
  });
});
