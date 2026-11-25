import { describe, expect, it } from "vitest";
import { D1NotificationQuotaCommandRepository } from "./notification-quota.command-repository";
import { createTestD1 } from "~/backend/infra/d1/test-helper";

const DAY = "2026-11-25";

describe("D1NotificationQuotaCommandRepository", () => {
  it("上限に達するまでは枠が取れ、達したら取れない", async () => {
    const quota = new D1NotificationQuotaCommandRepository(createTestD1());
    const take = (): Promise<boolean> =>
      quota.tryTake({ channel: "reaction-mail", day: DAY, limit: 2 });

    expect(await take()).toBe(true);
    expect(await take()).toBe(true);
    expect(await take()).toBe(false);
    expect(await take()).toBe(false);
  });

  it("日付が変われば枠も新しくなる", async () => {
    const quota = new D1NotificationQuotaCommandRepository(createTestD1());

    await quota.tryTake({ channel: "reaction-mail", day: DAY, limit: 1 });

    expect(await quota.tryTake({ channel: "reaction-mail", day: "2026-11-26", limit: 1 })).toBe(
      true,
    );
  });

  it("通知の種類ごとに別の枠を持つ", async () => {
    const quota = new D1NotificationQuotaCommandRepository(createTestD1());

    await quota.tryTake({ channel: "reaction-mail", day: DAY, limit: 1 });

    expect(await quota.tryTake({ channel: "another", day: DAY, limit: 1 })).toBe(true);
  });

  it("上限が 0 なら 1 通も取れない", async () => {
    const quota = new D1NotificationQuotaCommandRepository(createTestD1());

    expect(await quota.tryTake({ channel: "reaction-mail", day: DAY, limit: 0 })).toBe(false);
  });

  /*
   * 枠を取る操作は upsert 1 手で、読んでから書かない。同時に投げても上限を越えない
   * ことを確かめる (手元の node:sqlite は直列に流すが、少なくとも 1 手で判定している
   * 限り、並べて投げた数が上限を越えて通ることは無い)。
   */
  it("同時に投げても上限を越えて取れない", async () => {
    const quota = new D1NotificationQuotaCommandRepository(createTestD1());

    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        quota.tryTake({ channel: "reaction-mail", day: DAY, limit: 3 }),
      ),
    );

    expect(results.filter(Boolean)).toHaveLength(3);
  });
});
