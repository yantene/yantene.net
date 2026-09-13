import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import { AdminSessionId } from "./admin-session-id.vo";
import { AdminSession, ADMIN_SESSION_RENEWAL_INTERVAL_MINUTES } from "./admin-session.entity";
import { CredentialId } from "./credential-id.vo";

const startedAt = Temporal.Instant.from("2026-01-01T00:00:00Z");

function session(): AdminSession {
  return AdminSession.start({
    id: AdminSessionId.issue(),
    credentialId: CredentialId.create("Y3JlZA"),
    at: startedAt,
  });
}

describe("AdminSession", () => {
  /*
   * 画面の操作はどれも「叩く → 読み直す」の対で、間を置かずに 2 度この記録に触る。
   * 毎回書き戻すと同じ鍵への連続した書き込みになり、置き場の上限に当たると
   * サインインした直後に画面が壊れる。
   */
  it("does not ask to be renewed again right away", () => {
    expect(session().needsRenewal(startedAt)).toBe(false);
    expect(session().needsRenewal(startedAt.add({ milliseconds: 100 }))).toBe(false);
    expect(
      session().needsRenewal(
        startedAt.add({ minutes: ADMIN_SESSION_RENEWAL_INTERVAL_MINUTES }).subtract({ seconds: 1 }),
      ),
    ).toBe(false);
  });

  /* 間が空けば書き戻す。書かないままだと 14 日の持ち回りが延びない。 */
  it("asks to be renewed once the interval has passed", () => {
    expect(
      session().needsRenewal(startedAt.add({ minutes: ADMIN_SESSION_RENEWAL_INTERVAL_MINUTES })),
    ).toBe(true);
    expect(session().needsRenewal(startedAt.add({ hours: 24 }))).toBe(true);
  });

  /* 書き戻したら、そこからまた間隔ぶん待つ。 */
  it("restarts the interval from the moment it was renewed", () => {
    const at = startedAt.add({ hours: 24 });
    const touched = session().withSeen(at);

    expect(touched.lastSeenAt.equals(at)).toBe(true);
    expect(touched.needsRenewal(at.add({ minutes: 1 }))).toBe(false);
    expect(touched.needsRenewal(at.add({ minutes: ADMIN_SESSION_RENEWAL_INTERVAL_MINUTES }))).toBe(
      true,
    );
  });
});
