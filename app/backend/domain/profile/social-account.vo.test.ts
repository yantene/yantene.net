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

  /*
   * メールだけスキームが違う (#514)。**通す側と弾く側の両方を書く。**
   *
   * 片方だけだと「mail に mailto を通す」を満たしたまま「github にも mailto を通す」
   * 状態に戻せてしまう。そうなると、GitHub の印が付いた連絡先という嘘ができる。
   */
  it("accepts mailto: for email", () => {
    const account = SocialAccount.create({
      platform: "email",
      url: "mailto:contact@example.com",
      isMe: true,
    });
    expect(account.platform).toBe("email");
    expect(account.url).toBe("mailto:contact@example.com");
  });

  it("rejects anything but mailto: for email", () => {
    for (const url of [
      "https://example.com/",
      "http://example.com/",
      "javascript:alert(1)",
      "contact@example.com",
      /* 宛先の書き忘れ。URL としては成立してしまうので、別に弾いている。 */
      "mailto:",
      "mailto:contact",
    ]) {
      expect(() => SocialAccount.create({ platform: "email", url, isMe: false })).toThrow(
        InvalidSocialUrlError,
      );
    }
  });

  /* 逆向き。よその会社の先に mailto: を書けてしまわないこと。 */
  it("rejects mailto: for every platform but email", () => {
    for (const platform of ["github", "x", "bluesky", "mastodon", "discord"]) {
      expect(() =>
        SocialAccount.create({ platform, url: "mailto:a@example.com", isMe: false }),
      ).toThrow(InvalidSocialUrlError);
    }
  });
});
