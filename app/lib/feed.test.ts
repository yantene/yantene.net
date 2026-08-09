import { describe, expect, it } from "vitest";
import { feedIdentity } from "./feed";

/*
 * フィード本体 (backend) とページの rel=alternate (frontend) が同じ名乗りを使うための
 * 唯一の出どころ。ここがずれると、リーダーに見える名前と実際のフィードが食い違う。
 */
describe("feedIdentity", () => {
  it("names the site-wide feed after the site and points at its root", () => {
    expect(feedIdentity()).toEqual({
      title: "yantene.net",
      subtitle: "yantene の発信を集約するハブ",
      path: "/feed.xml",
      alternatePath: "/",
    });
  });

  it("treats a missing tag the same whether it is undefined or null", () => {
    expect(feedIdentity(null)).toEqual(feedIdentity());
  });

  it("names a tag feed after the tag and points at the filtered list", () => {
    expect(feedIdentity("Web")).toEqual({
      title: "yantene.net — Web",
      subtitle: "タグ「Web」のノート",
      path: "/feed.xml?tag=Web",
      alternatePath: "/notes?tag=Web",
    });
  });

  /*
   * 空白を + で表すのは application/x-www-form-urlencoded の作法。%20 のままなら
   * どのパーサを通しても同じタグに戻る。
   */
  it("percent-encodes the tag in both URLs", () => {
    const identity = feedIdentity("a b&c");

    expect(identity.path).toBe("/feed.xml?tag=a%20b%26c");
    expect(identity.alternatePath).toBe("/notes?tag=a%20b%26c");
  });

  /* id は購読の同一性を決める鍵なので、タグごとに別の URI になること。 */
  it("gives each tag a distinct alternate path", () => {
    expect(feedIdentity("Web").alternatePath).not.toBe(
      feedIdentity("日記").alternatePath,
    );
    expect(feedIdentity("Web").alternatePath).not.toBe(
      feedIdentity().alternatePath,
    );
  });
});
