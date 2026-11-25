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
  const open = ".site-header-band:has(.site-menu-panel:popover-open)";

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

/**
 * 畳んだ板 (popover) の置き方の見張り。
 *
 * ⚠️ **どれも見た目でしか気づけない。** テストの DOM には CSS が無く、popover の既定の
 * 姿 (閉じていれば隠す、開けば画面の中央) も当たらない。
 */
describe("畳んだ板の置き方", () => {
  /*
   * 閉じた板を隠しているのはブラウザの既定 `[popover]:not(:popover-open) { display: none }`。
   * 作者の CSS はそれより必ず強いので、板の規則に display を書くと閉じたまま出続ける。
   */
  it.each([".site-menu-panel", ".header-menu-panel"])(
    "%s は閉じているときの display を決めない",
    (selector) => {
      expect(block(selector)).not.toMatch(/(?:^|\s)display:/mu);
    },
  );

  /*
   * 先に書いた値は、CSS anchor positioning の読めないブラウザの落とし先。後ろの
   * `anchor()` だけにすると、そこでは板がブラウザの既定 (画面の中央) に浮く。
   */
  it.each([".site-menu-panel", ".header-menu-panel"])(
    "%s は anchor() の前に、読めないブラウザのための位置を書いている",
    (selector) => {
      const rule = block(selector);
      const fallback = rule.search(/\btop: (?:[\d.]+rem|var\(--header-clearance\));/u);
      const anchored = rule.search(/\btop: [^;]*anchor\(/u);

      expect(fallback, "落とし先の top が無い").toBeGreaterThan(-1);
      expect(anchored, "anchor() の top が無い").toBeGreaterThan(fallback);
    },
  );

  /* ブラウザは `[popover]` を画面の中央に置く (`inset: 0; margin: auto`)。外さないと寄らない。 */
  it.each([".site-menu-panel", ".header-menu-panel"])(
    "%s はブラウザの既定の中央寄せを外す",
    (selector) => {
      const rule = block(selector);

      expect(rule).toMatch(/\binset: auto/u);
      expect(rule).toMatch(/\bmargin: 0;/u);
    },
  );
});
