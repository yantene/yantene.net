#!/usr/bin/env node
/**
 * リアクションのチップに出す Twemoji の SVG を public/ へ写す。
 *
 * チップは記事ページに常設で、いちばん多い形は ❤️ 1 つだけ。そのために 617KB の
 * woff2 を読ませていたので (#200)、チップだけ SVG に切り替えた。1 枚 1.7KB 前後なので、
 * 実際に押されているぶんしか通信が起きない。パレットは開いたときだけ描かれるので、
 * あちらは今までどおりフォントで組む。
 *
 * 写すのはパレットが許す絵文字だけ。受け入れる絵文字は生成した一覧に完全一致するもの
 * だけなので (ADR 0012)、それ以外がチップに出ることはない。
 *
 * **リポジトリには置かない。** 2.8MB あり、node_modules から機械的に導けるものなので、
 * postinstall で毎回作り直す。public/emoji/svg/ は .gitignore に入れてある。
 */
import { existsSync, mkdirSync, readFileSync, copyFileSync, rmSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const PALETTE = "public/emoji/palette-ja.json";
const OUT_DIR = "public/emoji/svg";

/**
 * 絵文字を Twemoji のファイル名に均す。
 *
 * VS16 (U+FE0F) を落とすのは、Twemoji が異体字セレクタを名前に含めないため。
 * ❤️ (2764 fe0f) は `2764.svg` になる。
 */
function fileNameFor(emoji) {
  return `${[...emoji]
    .map((c) => c.codePointAt(0))
    .filter((cp) => cp !== 0xfe_0f)
    .map((cp) => cp.toString(16))
    .join("-")}.svg`;
}

// SVG はパッケージの直下に並んでいる (サブディレクトリを切っていない)。
const svgDir = path.dirname(require.resolve("@twemoji/svg/package.json"));
if (!existsSync(svgDir)) {
  throw new Error(`@twemoji/svg の SVG が見つからない: ${svgDir}`);
}

const groups = JSON.parse(readFileSync(PALETTE, "utf8"));
const emojis = groups.flatMap((group) => group.emojis.map((entry) => entry.u));

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

let copied = 0;
const missing = [];
for (const emoji of emojis) {
  const name = fileNameFor(emoji);
  const from = path.join(svgDir, name);
  if (!existsSync(from)) {
    missing.push(emoji);
    continue;
  }
  copyFileSync(from, path.join(OUT_DIR, name));
  copied += 1;
}

/*
 * @twemoji/svg は Unicode 15 まで。フォント (@sableclient/twemoji-font) は 17 に
 * 追随しているので、新しい絵文字には SVG が無い。描画側は素の文字へ落とすので
 * 壊れないが、意匠は環境まかせになる。**黙って減らさない**ために数を出す。
 */
console.log(
  `✓ ${String(copied)} 個の Twemoji SVG を ${OUT_DIR} へ写した` +
    (missing.length > 0 ? ` (SVG が無く素の文字に落ちるもの: ${String(missing.length)} 個)` : ""),
);
