#!/usr/bin/env node
/**
 * Check that ADR files in docs/adr/ have unique numbers.
 *
 * Expected format: NNNN-<slug>.md (e.g. 0001-record-architecture-decisions.md)
 * Fails if:
 * - An ADR file doesn't match the naming pattern
 * - Two ADR files share the same number
 *
 * Non-ADR files (README.md, template.md) are excluded.
 */
import { existsSync, readdirSync } from "node:fs";

const ADR_DIR = "docs/adr";

if (!existsSync(ADR_DIR)) {
  throw new Error(`ADR validation failed: directory not found: ${ADR_DIR}`);
}

const EXCLUDED = new Set(["README.md", "template.md"]);
const PATTERN = /^(\d{4})-[\da-z-]+\.md$/;

const files = readdirSync(ADR_DIR).filter(
  (f) => !EXCLUDED.has(f) && f.endsWith(".md"),
);

if (files.length === 0) {
  console.log(`✓ No ADR files found in ${ADR_DIR}`);
} else {
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
      errors.push(
        `Duplicate ADR number ${num}: ${numbers.get(num)} and ${file}`,
      );
    } else {
      numbers.set(num, file);
    }
  }

  if (errors.length > 0) {
    const detail = errors.map((e) => "  " + e).join("\n");
    throw new Error(`ADR validation failed:\n\n${detail}`);
  }

  console.log(
    `✓ All ${files.length} ADR(s) in ${ADR_DIR} have valid unique numbers`,
  );
}
