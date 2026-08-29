import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * テーマの色を数値で抱えている場所を、定義と突き合わせる。
 *
 * 配色の正本は app.css の daisyUI テーマ (name: "yantene") と header.css の地平線で、
 * 画面は custom property と color-mix でそこから組み立てる。ところがその 2 つを使えない
 * 場所が 2 か所ある。オフラインページは本体の CSS が届かず (蓄えから直接返る)、OG カードは
 * Satori に静的な HTML を渡すため。どちらも色を数値で写すしかない。
 *
 * 写した値には `= --token` を添える規約にしてあり、ここがその印を拾って定義と照合する。
 * テーマ側だけを変えるとこのテストが落ちる。オフラインページも OG カードも、日々の
 * 開発では目に入らないまま古びていくため。
 *
 * 白地に乗せた合成値 (muted-foreground など) には印を付けない。color-mix の結果を
 * ここで再現するほうが、写し間違いより間違えやすい。
 */

/*
 * 読むのは import ではなく実ファイル。vitest は CSS の import を空にするので
 * (`test.css` の既定)、`?raw` を付けても中身が届かない。
 */
function read(relativePath: string): string {
  const path = fileURLToPath(new URL(relativePath, import.meta.url));
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- 読む先はこのファイルからの相対で、下に並べたリテラルに限られる。
  return readFileSync(path, "utf8");
}

/*
 * custom property の名前。先頭の 1 文字を英数字に限ってあるのは、`-` を含む文字クラスの
 * 繰り返しだけで書くと `--` の切れ目が一意に決まらず、正規表現がバックトラックするため。
 */
const TOKEN = "--[a-z0-9][a-z0-9-]*";
/** 色のリテラル (`#rgb` から `#rrggbbaa` まで)。 */
const COLOR = "#[0-9a-f]{3,8}";

/** 定義の側。`--token: #rrggbb` を拾う。 */
function collectDefinitions(css: string): Map<string, string> {
  const definition = new RegExp(`(${TOKEN}): ?(${COLOR})`, "gi");
  const definitions = new Map<string, string>();
  for (const match of css.matchAll(definition)) {
    definitions.set(match[1], match[2].toLowerCase());
  }
  return definitions;
}

/** 写した側。色リテラルに続く `= --token` の印を拾う。 */
function collectCopies(source: string): { token: string; value: string }[] {
  // 色の後ろは CSS なら `;`、TypeScript なら `";` と続く。どちらも同じ印で追える。
  // eslint-disable-next-line security/detect-non-literal-regexp -- 組み立てるのは上の 2 つの定数だけで、読んだファイルの中身は混ぜない。
  const copy = new RegExp(String.raw`(${COLOR})["']?;? ?/\* ?= ?(${TOKEN}) ?\*/`, "gi");
  return Array.from(source.matchAll(copy), (match) => ({
    token: match[2],
    value: match[1].toLowerCase(),
  }));
}

const definitions = new Map([
  ...collectDefinitions(read("./app.css")),
  ...collectDefinitions(read("./components/layout/header.css")),
]);

describe.each([
  { name: "オフラインページ", path: "../../public/offline.html" },
  { name: "OG カード", path: "../backend/handlers/og-card.ts" },
])("$name が写したテーマの色", ({ path }) => {
  const copies = collectCopies(read(path));

  /*
   * 印そのものが消えたことに気づくための番人。照合は「拾えたぶんだけ」を見るので、
   * 規約ごと剥がれると 0 件の照合が黙って通ってしまう。
   */
  it("印が付いている", () => {
    expect(copies.length).toBeGreaterThan(0);
  });

  it.each(copies)("$token を $value のまま写している", ({ token, value }) => {
    expect(definitions.get(token)).toBe(value);
  });
});
