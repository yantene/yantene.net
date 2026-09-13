import { describe, expect, it } from "vitest";
import { feedIdentities, feedIdentity } from "./feed";

/*
 * フィード本体 (backend) と、ページの rel=alternate・ヘッダーの選び場所 (frontend) が
 * 同じ名乗りを使うための唯一の出どころ。ここがずれると、リーダーに見える名前と実際の
 * フィードが食い違う。
 *
 * 種別がナビの行き先と対応していることは、ナビの表を読める側で見ている
 * (frontend/components/feed/feed-menu.test.tsx)。
 */
describe("feedIdentity", () => {
  it("names the site-wide feed after the site and points at its root", () => {
    expect(feedIdentity("all")).toEqual({
      kind: "all",
      title: "やんてね",
      subtitle: "Web の向こうから。エッセイ、技術記事、つくったもの。",
      path: "/feed.xml",
      alternatePath: "/",
      labelKey: "feed.all",
    });
  });

  /*
   * リーダーは title で購読先を見分ける。同じ名前が 2 つあると、別の種別を購読した
   * つもりの人の手元で 1 本に見える。
   */
  it("種別ごとのフィードは、全体と違う名前を名乗る", () => {
    const titles = feedIdentities.map((identity) => identity.title);

    expect(new Set(titles).size).toBe(titles.length);
  });

  /*
   * リーダーは path で購読先を覚える。重なっていると、別の種別を購読したつもりの人に
   * 同じものが届く。
   */
  it("行き先は重ならない", () => {
    const paths = feedIdentities.map((identity) => identity.path);

    expect(new Set(paths).size).toBe(paths.length);
  });

  it("知らない種別は静かに既定へ倒さず投げる", () => {
    // @ts-expect-error 型では閉じているが、型を跨いで呼ばれたときに壊れないことを見る。
    expect(() => feedIdentity("unknown")).toThrow();
  });
});
