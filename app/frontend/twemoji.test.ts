/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
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

/** Twemoji を当ててよい要素。中身が絵文字しかないものに限る。 */
const allowedTargets = new Set([".reaction-chip-emoji", ".emoji-palette-item"]);

/** Twemoji を当てている場所。ここを見失ったまま通ると、どのテストも意味がない。 */
const knownTarget = "components/reaction/reaction-bar.css";

/** `inherit` の仲間。値全体が単独でこれのときにしか使えない。 */
const cssWideKeyword = /\b(?:inherit|initial|unset|revert|revert-layer)\b/i;

function read(file: string): string {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- リポジトリ内の固定パス
  return readFileSync(path.join(frontendDir, file), "utf8");
}

/** frontend 以下の CSS をすべて挙げる。フォントの指定はどこにでも書けるため。 */
function cssFiles(): string[] {
  return readdirSync(frontendDir, { recursive: true, encoding: "utf8" }).filter((entry) =>
    entry.endsWith(".css"),
  );
}

/** コメントを落とす。説明文に書いたセレクタ名やフォント名を数えないため。 */
function withoutComments(css: string): string {
  return css.replaceAll(/\/\*[\s\S]*?\*\//g, "");
}

/** ページ全体のフォントを決めている `html` の中身を取り出す。 */
function htmlBlock(css: string): string {
  return /html\s*\{([^}]*)\}/s.exec(css)?.[1] ?? "";
}

/**
 * フォントの指定を、どのファイルのものかと一緒に挙げる。
 *
 * `font-family` だけでなく `font` の一括指定も拾う。同じ値をそちらにも書けるため。
 */
function fontDeclarations(): { file: string; value: string }[] {
  return cssFiles().flatMap((file) =>
    Array.from(
      withoutComments(read(file)).matchAll(/font(?:-family)?\s*:([^;}]*)/gi),
      ([, value]) => ({ file, value: value.trim() }),
    ),
  );
}

/**
 * Twemoji を当てている規則の当て先を、どのファイルのものかと一緒に挙げる。
 *
 * 規則の切り出しは分割で済ませる (入れ子の無い平たい CSS を前提にする)。入れ子の中に
 * 書かれるとセレクタを取り違えるが、その場合は当て先が一覧に無い形になって落ちる。
 */
function twemojiTargets(): { file: string; target: string }[] {
  return cssFiles().flatMap((file) =>
    withoutComments(read(file))
      .split("}")
      .flatMap((chunk) => {
        const parts = chunk.split("{");
        // `{` を含まない末尾の断片は規則ではない。
        if (parts.length < 2) return [];
        const [selector, body] = parts;
        if (!body.includes("Twemoji")) return [];
        return selector.split(",").map((target) => ({ file, target: target.trim() }));
      }),
  );
}

describe("Twemoji の適用範囲", () => {
  it("ページ全体のフォントスタックには入れない", () => {
    expect(htmlBlock(withoutComments(read("app.css")))).not.toContain("Twemoji");
  });

  it("フォント自体は読み込む", () => {
    expect(read("app.css")).toContain('@import "@sableclient/twemoji-font"');
  });

  /*
   * 本文のフォントは custom property から引く。Twemoji を当てる要素が「絵文字だけ
   * 受け持って残りは本文と同じ字で」と書くために名指しする先で、定義と参照のどちらが
   * 欠けても、それを引いている側の宣言ごと無効になる。
   */
  it("本文のフォントスタックは custom property に出す", () => {
    const block = htmlBlock(withoutComments(read("app.css")));
    expect(block).toMatch(/--body-font-stack:[^;]*sans-serif/);
    expect(block).toMatch(/font-family:\s*var\(--body-font-stack/);
  });

  it("絵文字だけが入る要素に当てる", () => {
    const targets = twemojiTargets();
    // 当てている場所を見失っていないこと。
    expect(targets.map(({ file }) => file)).toContain(knownTarget);

    // 押された数 (.reaction-chip-count) を巻き込むと、そこの数字が消える。
    for (const { file, target } of targets) {
      expect(allowedTargets, `${file}: ${target}`).toContain(target);
    }
  });

  /*
   * `font-family: Twemoji, inherit` と書いていて、フォントがどこにも当たっていなかった
   * (#193)。`inherit` などの CSS-wide keyword は値全体が単独でそれのときにしか使えず、
   * リストに混ぜると値がパースエラーになって宣言ごと捨てられる。
   *
   * 上のセレクタの検査と読み込みの検査は、どちらもこれを通してしまった。フォントは
   * 617KB を読んだうえで誰にも当たらず、例外も警告も出ない。フォールバックに他の字を
   * 従えたいときは `inherit` ではなく、そのスタック自体 (--body-font-stack) を書くこと。
   *
   * happy-dom は無効な値をそのまま保持するので、描画させても捕まらない。字面で見張る。
   */
  it("フォントの指定に CSS-wide keyword を混ぜない", () => {
    const declarations = fontDeclarations();
    // 拾えていること自体を先に確かめる。
    expect(declarations.map(({ file }) => file)).toContain(knownTarget);

    for (const { file, value } of declarations) {
      // 単独なら CSS-wide keyword でよい (`font-family: inherit` は有効)。
      // var() のフォールバックに隠れていても、置換後は同じ形になるので数える。
      const isMixed = value.includes(",") && cssWideKeyword.test(value);
      expect(isMixed, `${file}: font-family: ${value}`).toBe(false);
    }
  });
});
