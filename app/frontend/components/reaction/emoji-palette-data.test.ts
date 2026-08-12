import { describe, expect, it } from "vitest";
import { filterPalette } from "./emoji-palette-data";

const groups = [
  {
    name: "スマイリーと感情",
    emojis: [
      { u: "😀", l: "にっこり笑う", t: ["スマイル", "笑顔"] },
      { u: "😢", l: "泣く", t: ["悲しい"] },
    ],
  },
  {
    name: "動物自然",
    emojis: [{ u: "🐈", l: "ねこ", t: ["ペット", "くろねこ"] }],
  },
];

describe("filterPalette", () => {
  it("語が空なら全部そのまま返す", () => {
    expect(filterPalette(groups, "  ")).toBe(groups);
  });

  it("名前で絞り込む", () => {
    expect(filterPalette(groups, "ねこ")).toEqual([
      { name: "動物自然", emojis: [groups[1]?.emojis[0]] },
    ]);
  });

  /* タグは名前に無い言い回しを拾うために持っている。 */
  it("タグでも当たる", () => {
    expect(filterPalette(groups, "悲しい")).toEqual([
      { name: "スマイリーと感情", emojis: [groups[0]?.emojis[1]] },
    ]);
  });

  /*
   * 日本語には語の区切りが無いので、前方一致では「くろねこ」を「ねこ」で拾えない。
   * 含むかどうかで判ずる。
   */
  it("語の途中でも当たる", () => {
    expect(filterPalette(groups, "ろね")[0]?.emojis[0]?.u).toBe("🐈");
  });

  it("大文字と小文字を区別しない", () => {
    const latin = [
      { name: "Smileys", emojis: [{ u: "😀", l: "Grinning", t: [] }] },
    ];

    expect(filterPalette(latin, "GRIN")[0]?.emojis).toHaveLength(1);
  });

  /* 当たらなかった分類は畳む。空の見出しだけが並ぶのを避ける。 */
  it("何も当たらない分類は返さない", () => {
    expect(filterPalette(groups, "みつからない")).toEqual([]);
  });
});
