#!/usr/bin/env node
/**
 * リアクションに使える絵文字の一覧を emojibase-data から起こす。
 *
 * 生成物はリポジトリに置く。実行時に emojibase-data (50MB) を読ませないためと、
 * 何が増減したかを diff で見られるようにするため。データを更新したいときは
 * emojibase-data を上げてから、このスクリプトを流し直す。
 *
 *   node scripts/generate-emoji-data.mjs
 *
 * 出すのは 2 つ。
 *
 * - `app/lib/emoji/allowed-emoji.ts` — 絵文字の並びだけ。サーバーが受け入れの境界に使う
 * - `public/emoji/palette-<locale>.json` — パレットが出す分類とラベル。開いたときだけ読む
 *
 * パレットのデータを TS に埋め込まないのは、記事を開いただけの人にまで数百 KB を配りたく
 * ないため。静的ファイルとして置いて、パレットを開いた人だけが取りに行く。
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import enCompact from "emojibase-data/en/compact.json" with { type: "json" };
import enMessages from "emojibase-data/en/messages.json" with { type: "json" };
import jaCompact from "emojibase-data/ja/compact.json" with { type: "json" };
import jaMessages from "emojibase-data/ja/messages.json" with { type: "json" };

const OUTPUT = fileURLToPath(
  new URL("../app/lib/emoji/allowed-emoji.ts", import.meta.url),
);

const PALETTE_DIR = fileURLToPath(new URL("../public/emoji", import.meta.url));

/** 対応するロケール。パレットは表示中の言語のぶんだけ読む。 */
const LOCALES = [
  { code: "en", compact: enCompact, messages: enMessages },
  { code: "ja", compact: jaCompact, messages: jaMessages },
];

/** 肌の色 (EMOJI MODIFIER FITZPATRICK TYPE-1-2 〜 6)。 */
// eslint-disable-next-line security/detect-unsafe-regex -- 文字クラス 1 つの照合で、後戻りする余地がない
const SKIN_TONE = /[\u{1F3FB}-\u{1F3FF}]/u;

/** 髪の色のパーツ (EMOJI COMPONENT RED HAIR 〜 BALD)。 */
// eslint-disable-next-line security/detect-unsafe-regex -- 同上
const HAIR_COMPONENT = /[\u{1F9B0}-\u{1F9B3}]/u;

/**
 * 「コンポーネント」グループ。肌の色や髪の色のパーツ単体が入っている。
 * 単体では絵文字として成り立たないので落とす。
 */
const COMPONENT_GROUP = 2;

/**
 * リアクションに使える絵文字か。
 *
 * バリエーションは持たせない方針なので、肌の色・髪の色を含むものは入り口で落とす。
 * ここに無いものはサーバーが弾くため、この判定がそのまま受け入れの境界になる。
 */
function isReactable(emoji) {
  // group を持たないのは地域指標文字 (🇦 単体) で、旗の部品でしかない。
  if (emoji.group === undefined) return false;
  if (emoji.group === COMPONENT_GROUP) return false;
  if (SKIN_TONE.test(emoji.unicode)) return false;
  return !HAIR_COMPONENT.test(emoji.unicode);
}

const emojis = enCompact
  .filter((emoji) => isReactable(emoji))
  .map((emoji) => emoji.unicode);

const unique = [...new Set(emojis)];
if (unique.length !== emojis.length) {
  throw new Error(`duplicated emoji in the source data`);
}

const source = `// このファイルは自動生成される。手で編集しない。
// 生成: node scripts/generate-emoji-data.mjs (emojibase-data v${process.env.npm_package_dependencies_emojibase_data ?? "17"} 由来)

/**
 * リアクションに使える絵文字の一覧。
 *
 * 肌の色・髪の色の派生は含まない (バリエーションは持たせない方針)。単体では成り立たない
 * パーツ (肌の色の修飾子、地域指標文字) も除いてある。
 */
export const allowedEmoji: readonly string[] = ${JSON.stringify(unique, null, 2)};
`;

 
// eslint-disable-next-line security/detect-non-literal-fs-filename -- 出力先はこのファイルが決め打ちしている
writeFileSync(OUTPUT, source);
console.log(`wrote ${String(unique.length)} emoji to ${OUTPUT}`);

/*
 * パレットのデータ。並びは emojibase の order に従う (Unicode の推奨順で、
 * どの絵文字ピッカーでもおおむね見慣れた並びになる)。
 *
 * 検索に使うのはラベルとタグ。持たせる項目を絞っているのは、そのまま入れると
 * 倍近い大きさになるため。
 */
// eslint-disable-next-line security/detect-non-literal-fs-filename -- 出力先はこのファイルが決め打ちしている
mkdirSync(PALETTE_DIR, { recursive: true });

/** 分類ごとに束ねる。並びは emojibase の order に従う。 */
function groupByCategory(compact) {
  const groups = new Map();

  for (const emoji of compact) {
    if (!isReactable(emoji)) {
      // ここで畳んでおく。使えない絵文字を分類に入れるとパレットに出てしまう。
      continue;
    }

    const bucket = groups.get(emoji.group) ?? [];
    bucket.push({
      order: emoji.order ?? 0,
      entry: {
        u: emoji.unicode,
        l: emoji.label,
        // タグはラベルに含まれない言い回しだけを残す (検索の当たりを増やすため)。
        t: (emoji.tags ?? []).filter((tag) => !emoji.label.includes(tag)),
      },
    });
    groups.set(emoji.group, bucket);
  }

  return groups;
}

for (const locale of LOCALES) {
  const groups = groupByCategory(locale.compact);

  const palette = [...groups]
    .toSorted(([a], [b]) => a - b)
    .map(([group, items]) => ({
      // 分類の名前は messages.json が持っている (ロケールごとに訳されている)。
      name: locale.messages.groups.find((g) => g.order === group)?.message ?? "",
      emojis: items.toSorted((a, b) => a.order - b.order).map((i) => i.entry),
    }));

  const path = `${PALETTE_DIR}/palette-${locale.code}.json`;
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- 出力先はこのファイルが決め打ちしている
  writeFileSync(path, JSON.stringify(palette));
  const count = palette.reduce((sum, g) => sum + g.emojis.length, 0);
  console.log(`wrote ${String(count)} emoji in ${String(palette.length)} groups to ${path}`);
}
