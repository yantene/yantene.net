import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import { SessionId } from "./session-id.vo";
import { Session } from "./session.entity";
import { NoteSlug } from "~/backend/domain/note";

const today = Temporal.PlainDate.from("2026-08-12");
const tomorrow = Temporal.PlainDate.from("2026-08-13");
const alpha = NoteSlug.create("alpha");
const beta = NoteSlug.create("beta");

function newSession(): Session {
  return Session.start(SessionId.issue(), today);
}

describe("Session.start", () => {
  it("起こしたばかりなら何も読んでいない", () => {
    const session = newSession();
    expect(session.hasViewed(alpha, today)).toBe(false);
    expect(session.viewedOn).toBeUndefined();
    expect(session.viewedNotes).toStrictEqual([]);
  });
});

describe("Session#withView", () => {
  it("数えた記事を覚える", () => {
    const session = newSession().withView(alpha, today);
    expect(session.hasViewed(alpha, today)).toBe(true);
  });

  it("元のセッションは書き換えない", () => {
    const session = newSession();
    session.withView(alpha, today);
    expect(session.hasViewed(alpha, today)).toBe(false);
  });

  it("覚えるのは数えた記事だけ", () => {
    const session = newSession().withView(alpha, today);
    expect(session.hasViewed(beta, today)).toBe(false);
  });

  it("同じ日なら積み上げる", () => {
    const session = newSession().withView(alpha, today).withView(beta, today);
    expect(session.hasViewed(alpha, today)).toBe(true);
    expect(session.hasViewed(beta, today)).toBe(true);
  });

  it("日が変われば前日ぶんは捨てる", () => {
    // 溜め続けると、読み手の閲覧履歴そのものを持つことになる。
    const session = newSession().withView(alpha, today).withView(beta, tomorrow);
    expect(session.viewedNotes).toStrictEqual([beta]);
    expect(session.hasViewed(alpha, tomorrow)).toBe(false);
  });

  it("同じ記事を重ねても増えない", () => {
    const session = newSession().withView(alpha, today).withView(alpha, today);
    expect(session.viewedNotes).toStrictEqual([alpha]);
  });

  it("識別子と開始日は引き継ぐ", () => {
    const started = newSession();
    const session = started.withView(alpha, tomorrow);
    expect(session.id.equals(started.id)).toBe(true);
    expect(session.startedOn.equals(today)).toBe(true);
  });
});

describe("Session#hasViewed", () => {
  it("日が違えば数えていない扱い", () => {
    const session = newSession().withView(alpha, today);
    expect(session.hasViewed(alpha, tomorrow)).toBe(false);
  });
});
