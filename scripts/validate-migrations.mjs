#!/usr/bin/env node
/**
 * Validate that all migration files can be applied to an in-memory SQLite database.
 * Uses Node.js built-in `node:sqlite` (requires Node.js 24+).
 */
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

const journal = JSON.parse(
  readFileSync("./migrations/meta/_journal.json", "utf8"),
);

const db = new DatabaseSync(":memory:");

for (const entry of journal.entries) {
  const filePath = `./migrations/${entry.tag}.sql`;
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- migration paths from trusted _journal.json
  const sql = readFileSync(filePath, "utf8");

  // Drizzle separates statements with '--> statement-breakpoint'
  const statements = sql.split("--> statement-breakpoint");

  for (const stmt of statements) {
    const trimmed = stmt.trim();
    if (trimmed) {
      try {
        db.exec(trimmed);
      } catch (error) {
        throw new Error(
          [
            `✗ Failed to apply migration: ${filePath}`,
            `  Statement: ${trimmed.slice(0, 80)}...`,
            `  Error: ${error.message}`,
          ].join("\n"),
        );
      }
    }
  }

  console.log(`✓ ${entry.tag}`);
}

console.log(`\n✓ All ${journal.entries.length} migration(s) applied successfully`);
