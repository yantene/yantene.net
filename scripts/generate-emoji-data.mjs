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
 * 出すのは「絵文字そのもの」の並びだけ。ラベルやタグ (パレットの検索に要るもの) は
 * 桁が違う大きさになるので、パレットを作るときに別の生成物として足す。
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import compact from "emojibase-data/en/compact.json" with { type: "json" };

const OUTPUT = fileURLToPath(
  new URL("../app/lib/emoji/allowed-emoji.ts", import.meta.url),
);

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

const emojis = compact
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
