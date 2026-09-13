import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { feedIdentities } from "~/lib/feed";

/*
 * Service Worker (`public/sw.js`) は素の JavaScript として配信するファイルで、束ねられない
 * (import できない)。それでも「蓄えてよいか」の判定は**フィードの表と揃っていないと
 * 壊れる**ので、原文からその関数だけを取り出して動かす。
 *
 * 取り出せるのは、この関数が `url.pathname` しか見ていないため。よそを参照し始めたら
 * ここが落ちるので、そのときは切り出し方を考え直すこと。
 */
function loadIsCacheable(): (url: URL) => boolean {
  // vitest はリポジトリの根から走るので、そこからの相対で読む。
  const source = readFileSync("public/sw.js", "utf8");
  const match = /function isCacheable\(url\) \{[^]*?\n\}/u.exec(source);
  if (match === null) throw new Error("isCacheable が sw.js に見つからない");

  /* 取り出した関数だけを空の文脈で走らせる。読むのは自分のリポジトリの原文。 */
  return runInNewContext(`${match[0]}; isCacheable;`) as (url: URL) => boolean;
}

const isCacheable = loadIsCacheable();

function cacheable(path: string): boolean {
  return isCacheable(new URL(path, "https://yantene.net"));
}

describe("Service Worker が蓄えるもの", () => {
  /*
   * **フィードは 1 本も蓄えない。** リーダーが読むものなので、古いものを返した時点で
   * 更新が届かなくなる。
   *
   * 帯のリンクから開くと `mode === "navigate"` になるため、蓄えていると通信が途切れた
   * ときに XML の URL へ `offline.html` (text/html) が返る、という壊れ方までする。
   */
  it.each(feedIdentities.map((identity) => identity.path))("%s は蓄えない", (path) => {
    expect(cacheable(path)).toBe(false);
  });

  it("sitemap と API も蓄えない", () => {
    expect(cacheable("/sitemap.xml")).toBe(false);
    expect(cacheable("/api/v1/articles")).toBe(false);
  });

  /* 原文 Markdown は保存目的で開かれるので素通しにする。 */
  it("原文 Markdown は蓄えない", () => {
    expect(cacheable("/articles/hello-world.md")).toBe(false);
  });

  /* 蓄える側も見ておく。全部を弾いてしまっては Service Worker を置く意味が無い。 */
  it("ページと資材は蓄える", () => {
    expect(cacheable("/articles")).toBe(true);
    expect(cacheable("/articles/hello-world")).toBe(true);
    expect(cacheable("/assets/app-abc123.js")).toBe(true);
  });
});
