import { describe, expect, it } from "vitest";
import { buildSessionCookie, readSessionId, SESSION_COOKIE } from "./session-cookie";
import { SessionId } from "~/backend/domain/session";

const id = SessionId.issue();
const secure = { secure: true };

/** その Set-Cookie を持ち帰ったブラウザが次に送ってくる Cookie ヘッダー。 */
function roundTrip(header: string): string {
  return header.split(";", 1)[0];
}

describe("readSessionId", () => {
  it("cookie が無ければ undefined", () => {
    expect(readSessionId(null)).toBeUndefined();
    expect(readSessionId("")).toBeUndefined();
    expect(readSessionId("other=1")).toBeUndefined();
  });

  it("預けた識別子を読み戻せる", () => {
    const read = readSessionId(roundTrip(buildSessionCookie(id, secure)));
    expect(read?.equals(id)).toBe(true);
  });

  it("ほかの cookie が並んでいても取り出せる", () => {
    const read = readSessionId(`a=1; ${SESSION_COOKIE}=${id.toString()}; b=2`);
    expect(read?.equals(id)).toBe(true);
  });

  it("名前が途中で一致するだけの cookie は拾わない", () => {
    expect(readSessionId(`not-session=${id.toString()}`)).toBeUndefined();
  });

  it("形の違う値は持っていない扱いにする", () => {
    // 読み手が書き換えられる値なので、読めなければ発行し直すだけにする。
    expect(readSessionId(`${SESSION_COOKIE}=`)).toBeUndefined();
    expect(readSessionId(`${SESSION_COOKIE}=../../etc/passwd`)).toBeUndefined();
    expect(readSessionId(`${SESSION_COOKIE}=${"a".repeat(500)}`)).toBeUndefined();
  });
});

describe("buildSessionCookie", () => {
  it("識別子だけを載せる", () => {
    expect(buildSessionCookie(id, secure)).toContain(`${SESSION_COOKIE}=${id.toString()}`);
  });

  it("鍵として守る属性を付ける", () => {
    const cookie = buildSessionCookie(id, secure);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    // セッションはノートに限らないのでサイト全体に効かせる。
    expect(cookie).toContain("Path=/");
  });

  it("Secure は development でだけ外れる", () => {
    expect(buildSessionCookie(id, { secure: true })).toContain("Secure");
    expect(buildSessionCookie(id, { secure: false })).not.toContain("Secure");
  });

  it("ブラウザが許す上限 (400 日) まで持たせる", () => {
    expect(buildSessionCookie(id, secure)).toContain(`Max-Age=${String(400 * 86_400)}`);
  });
});
