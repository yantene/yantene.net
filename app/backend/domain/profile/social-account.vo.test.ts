import { describe, expect, it } from "vitest";
import {
  InvalidSocialUrlError,
  SocialAccount,
  UnknownSocialPlatformError,
} from "./social-account.vo";

describe("SocialAccount", () => {
  it("accepts a known platform", () => {
    const account = SocialAccount.create({
      platform: "github",
      url: "https://github.com/yantene",
      isMe: true,
    });
    expect(account.platform).toBe("github");
    expect(account.url).toBe("https://github.com/yantene");
    expect(account.isMe).toBe(true);
  });

  it("reads the platform case-insensitively", () => {
    expect(
      SocialAccount.create({ platform: "GitHub", url: "https://github.com/yantene", isMe: false })
        .platform,
    ).toBe("github");
  });

  /*
   * アイコンを持っていない先を通すと、書いたのに何も出ない行ができる。refresh が
   * これを握って理由を返す。
   */
  it("rejects a platform it has no icon for", () => {
    expect(() =>
      SocialAccount.create({ platform: "myspace", url: "https://example.com/", isMe: false }),
    ).toThrow(UnknownSocialPlatformError);
  });

  it("rejects URLs that are not absolute http(s)", () => {
    for (const url of ["/yantene", "example.com", "javascript:alert(1)", "mailto:a@example.com"]) {
      expect(() => SocialAccount.create({ platform: "github", url, isMe: false })).toThrow(
        InvalidSocialUrlError,
      );
    }
  });
});
