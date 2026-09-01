import { describe, expect, it } from "vitest";
import { feedIdentity } from "./feed";

/*
 * フィード本体 (backend) とページの rel=alternate (frontend) が同じ名乗りを使うための
 * 唯一の出どころ。ここがずれると、リーダーに見える名前と実際のフィードが食い違う。
 */
describe("feedIdentity", () => {
  it("names the site-wide feed after the site and points at its root", () => {
    expect(feedIdentity()).toEqual({
      title: "やんてね",
      subtitle: "Web の向こうから。エッセイ、技術記事、つくったもの。",
      path: "/feed.xml",
      alternatePath: "/",
    });
  });
});
