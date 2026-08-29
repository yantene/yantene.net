import { describe, expect, it } from "vitest";
import { InvalidSessionIdError, SessionId } from "./session-id.vo";

describe("SessionId.issue", () => {
  it("cookie にも KV のキーにも載る形で発行する", () => {
    expect(SessionId.issue().toString()).toMatch(/^[\w-]{22}$/);
  });

  it("発行するたびに違う値になる", () => {
    // 当てられると他人のセッションになりすませるので、ここが崩れると致命的。
    const issued = new Set(Array.from({ length: 1000 }, () => SessionId.issue().toString()));
    expect(issued.size).toBe(1000);
  });

  it("発行した値は読み戻せる", () => {
    const id = SessionId.issue();
    expect(SessionId.create(id.toString()).equals(id)).toBe(true);
  });
});

describe("SessionId.create", () => {
  it("形の違う値は受け付けない", () => {
    expect(() => SessionId.create("")).toThrow(InvalidSessionIdError);
    // 短い・長い
    expect(() => SessionId.create("a".repeat(21))).toThrow(InvalidSessionIdError);
    expect(() => SessionId.create("a".repeat(23))).toThrow(InvalidSessionIdError);
    // base64url の外の文字 (cookie やキーを壊しうる)
    expect(() => SessionId.create(`${"a".repeat(21)}=`)).toThrow(InvalidSessionIdError);
    expect(() => SessionId.create(`${"a".repeat(21)};`)).toThrow(InvalidSessionIdError);
    expect(() => SessionId.create(`${"a".repeat(21)}/`)).toThrow(InvalidSessionIdError);
  });

  it("同じ値どうしは等しい", () => {
    const raw = "a".repeat(22);
    expect(SessionId.create(raw).equals(SessionId.create(raw))).toBe(true);
    expect(SessionId.create(raw).equals(SessionId.issue())).toBe(false);
  });
});
