#!/usr/bin/env node
/**
 * Check ADR files in docs/adr/ and every reference to them across the repository.
 *
 * Expected format: NNNN-<slug>.md (e.g. 0001-record-architecture-decisions.md)
 * Fails if:
 * - An ADR file doesn't match the naming pattern
 * - Two ADR files share the same number
 * - A reference points at a number that is neither an existing ADR nor a
 *   consolidated one recorded in README.md
 *
 * 欠番そのものは許す。同じ主題の ADR を統合すると番号が空くが、その番号を指す参照は
 * リポジトリの外 (コミットメッセージ・マージ済み PR) に残り続けるので、README の
 * 「統合した番号」表が行き先を示す。ここではその表に載っていることを確かめる。
 *
 * Non-ADR files (README.md, template.md) are excluded.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ADR_DIR = "docs/adr";

if (!existsSync(ADR_DIR)) {
  throw new Error(`ADR validation failed: directory not found: ${ADR_DIR}`);
}

const EXCLUDED = new Set(["README.md", "template.md"]);
const PATTERN = /^(\d{4})-[\da-z-]+\.md$/;

const files = readdirSync(ADR_DIR).filter((f) => !EXCLUDED.has(f) && f.endsWith(".md"));

const errors = [];
const numbers = new Map();

for (const file of files) {
  const match = PATTERN.exec(file);
  if (!match) {
    errors.push(`Invalid ADR filename: ${file} (expected NNNN-<slug>.md)`);
    continue;
  }

  const num = match[1];
  if (numbers.has(num)) {
    errors.push(`Duplicate ADR number ${num}: ${numbers.get(num)} and ${file}`);
  } else {
    numbers.set(num, file);
  }
}

/** README の「統合した番号」表から、旧番号 → 行き先の対応を読む。 */
function readConsolidated() {
  const readmePath = path.join(ADR_DIR, "README.md");
  if (!existsSync(readmePath)) return new Map();

  const rows = readFileSync(readmePath, "utf8").matchAll(/^\|\s*(\d{4})\s*\|\s*\[?(\d{4})/gm);
  return new Map([...rows].map((m) => [m[1], m[2]]));
}

const consolidated = readConsolidated();

for (const [from, to] of consolidated) {
  if (numbers.has(from)) {
    errors.push(`ADR ${from} is listed as consolidated in README.md but the file still exists`);
  }
  if (!numbers.has(to)) {
    errors.push(`README.md says ADR ${from} was merged into ${to}, which does not exist`);
  }
}

/**
 * リポジトリ中の参照を集めて、行き先が実在するかを確かめる。
 *
 * git が追跡しているファイルだけを見る (node_modules や build を掘らないため)。
 */
function checkReferences() {
  const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" })
    .split("\n")
    .filter((f) => /\.(ts|tsx|js|mjs|md|css|json|jsonc|yml|yaml)$/.test(f));

  const REFERENCE = /(?:ADR[  ]|adr\/|docs\/adr\/)(\d{4})/g;

  for (const file of tracked) {
    if (!existsSync(file)) continue;

    const isOwnAdr = PATTERN.exec(path.basename(file));
    for (const [, num] of readFileSync(file, "utf8").matchAll(REFERENCE)) {
      // 自分自身の番号は参照ではない (見出しや Status に出る)。
      if (isOwnAdr && isOwnAdr[1] === num) continue;
      if (numbers.has(num)) continue;

      const to = consolidated.get(num);
      errors.push(
        to === undefined
          ? `${file}: references ADR ${num}, which does not exist`
          : `${file}: references ADR ${num}, which was consolidated into ${to}. Point at ${to} instead.`,
      );
    }
  }
}

checkReferences();

if (errors.length > 0) {
  const detail = errors.map((e) => "  " + e).join("\n");
  throw new Error(`ADR validation failed:\n\n${detail}`);
}

console.log(
  `✓ ${files.length} ADR(s) in ${ADR_DIR}: numbers unique, all references resolve` +
    (consolidated.size > 0 ? ` (${consolidated.size} consolidated)` : ""),
);
