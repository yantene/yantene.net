import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/*
 * CSS は import ではなく実ファイルから読む (vitest は CSS の import を空にする。理由と
 * 前例は theme-tokens.test.ts / clock-origin.test.ts にある)。
 */
const css = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "header.css"),
  "utf8",
);

/**
 * 指定の選択子の規則そのものを取り出す。
 *
 * ⚠️ **行頭の `<選択子> {` としてだけ探す。** ただの `indexOf` にしていたときは、別の
 * 規則のコメントに書いた選択子を先に拾い、そちらのブロックを検査していた。検査は通るが
 * 何も見ていない (実際、わざと壊しても緑のままだった)。
 */
function block(selector: string): string {
  const at = css.indexOf(`\n${selector} {`);
  expect(at, `${selector} の規則が見つからない`).toBeGreaterThan(-1);
  const rest = css.slice(at + 1);
  return rest.slice(0, rest.indexOf("}"));
}

/**
 * ドロワーを開いたときに、**帯と板が 1 枚の面として読める**ことを保つための見張り。
 *
 * ⚠️ **崩れても気づきにくい。** 継ぎ目が出るのはトップ・スクロール 0・狭い画面・開いて
 * いる、が揃ったときだけ。開発でその組み合わせを通ることはほとんど無く、実際これで
 * 「閉じる × だけが違う地の上に乗る」姿が出荷されていた。
 */
describe("ドロワーを開いたときの帯", () => {
  const open = ".site-header-band:has(.site-menu[open])";

  /*
   * トップの帯はスクロール 0 で完全に透明で、見えているのはヒーローの動く空。板は
   * 不透明なので、地を揃えないと空の色の帯に真っ白な板がくっつく。
   */
  it("板と同じ地になる", () => {
    const rule = block(open);

    expect(rule).toContain("background-color: var(--color-base-100)");
    expect(rule).toContain("backdrop-filter: none");
  });

  /*
   * 地はスクロール連動のアニメーションが持っている。アニメーションの値は普通の宣言より
   * 強いので、止めないと上の background-color が 1 ピクセルも効かない。**外しても
   * 宣言は残るので、CSS を読んだだけでは直っているように見える。**
   */
  it("地のアニメーションを止めている", () => {
    expect(block(open)).toContain("animation-name: none");
  });

  /*
   * トップでロゴを伏せているのは、すぐ下のヒーローが同じ名前を大きく出しているため。
   * 開くとそのヒーローは板の裏に隠れるので、伏せたままだと帯に × だけが浮く。
   */
  it("開いている間はロゴも出す", () => {
    expect(block(`${open} .site-header-mark`)).toContain("animation-name: none");
  });
});

/**
 * ドロワーの字の左端を 1 本に保つための見張り。
 *
 * 押し代を負の余白で戻していた頃は、押せる箱の左端が揃う代わりに**字だけが 8px 左へ
 * 出ていた** (見出しと行き先が 24px、その下の項目が 16px)。読み手が追うのは字の縁。
 */
describe("ドロワーの字の左端", () => {
  it.each([".site-menu-feed-list", ".locale-switch-options"])(
    "%s は押し代を負の余白で戻さない",
    (selector) => {
      expect(block(selector)).not.toMatch(/margin-inline:\s*-/u);
    },
  );
});
