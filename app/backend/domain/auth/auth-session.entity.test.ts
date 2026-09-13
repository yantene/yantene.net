import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import {
  AUTH_SESSION_RENEWAL_INTERVAL_MINUTES,
  AuthSession,
  AuthSessionId,
  EmailAddress,
} from "./index";

const START = Temporal.Instant.from("2026-09-13T00:00:00Z");

function session(): AuthSession {
  return AuthSession.start({
    id: AuthSessionId.issue(),
    email: EmailAddress.create("contact@yantene.net"),
    at: START,
  });
}

describe("AuthSession", () => {
  it("始めた時刻が最後に触った時刻になる", () => {
    const started = session();

    expect(started.lastSeenAt.equals(START)).toBe(true);
    expect(started.startedAt.equals(START)).toBe(true);
  });

  it("触った記録は書き換えず、新しいセッションを返す", () => {
    const started = session();
    const later = START.add({ hours: 2 });

    const seen = started.withSeen(later);

    expect(seen.lastSeenAt.equals(later)).toBe(true);
    expect(started.lastSeenAt.equals(START)).toBe(true);
  });

  /*
   * 毎回書き戻すと、同じ鍵への連続した書き込みになって弾かれることがある。
   * 弾かれた要求はそのまま落ちるので、入った直後に画面が壊れる。
   */
  it("間が空くまでは書き戻さない", () => {
    const started = session();

    expect(
      started.needsRenewal(START.add({ minutes: AUTH_SESSION_RENEWAL_INTERVAL_MINUTES - 1 })),
    ).toBe(false);
    expect(
      started.needsRenewal(START.add({ minutes: AUTH_SESSION_RENEWAL_INTERVAL_MINUTES })),
    ).toBe(true);
  });
});
