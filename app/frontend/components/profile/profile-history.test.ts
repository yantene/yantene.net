import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/*
 * CSS は import ではなく実ファイルから読む (vitest は CSS の import を空にする。理由と
 * 前例は theme-tokens.test.ts / clock-origin.test.ts にある)。相対パスの解決に `new URL` を
 * 使わないのは、happy-dom の URL が file: の基底を無視して http://localhost へ寄せるため。
 */
const css = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "profile-history.css"),
  "utf8",
);

/**
 * 経歴の年表の、**目に見えにくい壊れ方**を止める見張り。
 *
 * どちらも「それらしく出てしまう」ので、画面を見ただけでは気づきにくい。
 */
describe("profile-history.css", () => {
  /*
   * ⚠️ 項目ごとに grid を組んでいるので、札の列を `auto` にすると**行ごとに幅が決まる**。
   * 月を書いた行 (`2012-03`) と書いていない行 (`2011`) が混ざると、行ごとに本文の開始
   * 位置がずれる。1 行だけを見ても、全部の行に月を書いても気づけない。
   */
  it("札の列は固定幅で、auto にしない", () => {
    const wide = css.slice(css.indexOf("@media (width >= 40rem)"));
    const template = wide.slice(0, wide.indexOf("}"));

    expect(template).toContain("var(--history-stamp-column)");
    expect(template).not.toMatch(/var\(--history-dot-column\)\s+auto/u);
  });

  /*
   * ⚠️ 柱は固定幅で、VO は章の名前を 40 文字まで通す。折り返せない字 (`Freelancing` の
   * ようなラテン文字) は、折らないと右の列へはみ出して出来事の字に重なる。書き手には
   * 同期が通ったようにしか見えない。
   */
  it("章の名前はどんな字でも折り返す", () => {
    const rule = css.slice(css.indexOf(".profile-history-chapter-name"));

    expect(rule.slice(0, rule.indexOf("}"))).toContain("overflow-wrap: anywhere");
  });
});
