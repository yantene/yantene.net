import { describe, expect, it } from "vitest";
import { EmailAddress, InvalidEmailAddressError } from "./index";

describe("EmailAddress", () => {
  /*
   * 畳まないと `Contact@` と `contact@` が別人になり、同じ人が 2 通目のリンクで
   * 入れなくなる。
   */
  it("前後の空白を落とし、小文字に畳む", () => {
    expect(EmailAddress.create("  Contact@Yantene.NET ").toString()).toBe("contact@yantene.net");
  });

  it("同じアドレスは大文字小文字が違っても同じものとして扱う", () => {
    expect(
      EmailAddress.create("CONTACT@yantene.net").equals(EmailAddress.create("contact@yantene.net")),
    ).toBe(true);
  });

  it.each([
    ["空", ""],
    ["@ が無い", "contact.yantene.net"],
    ["ドメインにドットが無い", "contact@localhost"],
    ["ローカル部が空", "@yantene.net"],
    ["空白を含む", "con tact@yantene.net"],
    ["区切り文字を含む", "a@b.com,c@d.com"],
    ["名前付きの形", "yantene <contact@yantene.net>"],
    ["改行を含む", "contact@yantene.net\nbcc: evil@example.com"],
  ])("%s は読めない", (_name, raw) => {
    expect(() => EmailAddress.create(raw)).toThrow(InvalidEmailAddressError);
    expect(EmailAddress.parse(raw)).toBeUndefined();
  });

  it("長すぎるものは読めない", () => {
    const local = "a".repeat(250);
    expect(EmailAddress.parse(`${local}@yantene.net`)).toBeUndefined();
  });
});
