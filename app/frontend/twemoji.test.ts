/// <reference types="node" />
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
 * Twemoji の `unicode-range` には、キーキャップ絵文字 (`1️⃣` = U+0031 U+FE0F U+20E3) を
 * 組むために `U+23` (`#`)・`U+2A` (`*`)・`U+30-39` (ASCII 数字) が入っている。
 *
 * このフォントをページ全体のフォントスタックに置くと、本文の素の数字までこのフォントに
 * 解決され、素の数字グリフが無いので日付も型番も金額も画面から消える (#180)。例外も
 * 警告も出ず、字が無くなるだけなので、テストで置き場所を固定する。
 */

const frontendDir = import.meta.dirname;

function read(file: string): string {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- リポジトリ内の固定パス
  return readFileSync(path.join(frontendDir, file), "utf8");
}

/** コメントを落とす。説明文に書いたセレクタ名を規則として数えないため。 */
function withoutComments(css: string): string {
  return css.replaceAll(/\/\*[\s\S]*?\*\//g, "");
}

/** ページ全体のフォントを決めている `html` の指定を取り出す。 */
function htmlFontFamily(css: string): string {
  return /html\s*\{[^}]*?font-family:([^;]*);/s.exec(css)?.[1] ?? "";
}

describe("Twemoji の適用範囲", () => {
  it("ページ全体のフォントスタックには入れない", () => {
    const stack = htmlFontFamily(read("app.css"));
    // 取り出せていること自体を先に確かめる (指定を見失ったまま通ると意味がない)。
    expect(stack).toContain("sans-serif");
    expect(stack).not.toContain("Twemoji");
  });

  it("フォント自体は読み込む", () => {
    expect(read("app.css")).toContain('@import "@sableclient/twemoji-font"');
  });

  it("絵文字だけが入る要素に当てる", () => {
    const css = withoutComments(read("components/reaction/reaction-bar.css"));
    expect(css).toContain("font-family: Twemoji");

    // Twemoji を当てている規則のセレクタが、絵文字だけの要素に限られていること。
    // 押された数 (.reaction-chip-count) を巻き込むと、そこの数字が消える。
    const allowed = new Set([".reaction-chip-emoji", ".emoji-palette-item"]);
    // 規則の切り出しは分割で済ませる (入れ子の無い平たい CSS なので足りる)。
    for (const chunk of css.split("}")) {
      const parts = chunk.split("{");
      // `{` を含まない末尾の断片は規則ではない。
      if (parts.length < 2) continue;
      const [selector, body] = parts;
      if (!body.includes("Twemoji")) continue;
      const targets = selector.split(",").map((value) => value.trim());
      for (const target of targets) expect(allowed).toContain(target);
    }
  });
});
