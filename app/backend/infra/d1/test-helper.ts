/// <reference types="node" />
import { readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync, type StatementSync } from "node:sqlite";

const currentDir = import.meta.dirname;
const migrationsDir = path.join(currentDir, "../../../../migrations");
const journalPath = path.join(migrationsDir, "meta/_journal.json");

const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
  entries: Array<{ tag: string }>;
};
const migrationFiles = journal.entries.map(({ tag }) =>
  path.join(migrationsDir, `${tag}.sql`),
);

function createMockStatement(
  nodeSqlStmt: StatementSync,
  boundValues: unknown[],
): D1PreparedStatement {
  const stmt: D1PreparedStatement = {
    bind: (...values: unknown[]) => createMockStatement(nodeSqlStmt, values),
    run: () => {
      const result = nodeSqlStmt.run(
        ...(boundValues as Parameters<StatementSync["run"]>),
      );
      return Promise.resolve({
        results: [],
        meta: {
          changes: Number(result.changes),
          last_row_id: Number(result.lastInsertRowid),
          duration: 0,
          size_after: 0,
          rows_read: 0,
          rows_written: 0,
          changed_db: Number(result.changes) > 0,
        },
        success: true,
      } as D1Result);
    },
    all: <T = Record<string, unknown>>() => {
      const rows = nodeSqlStmt.all(
        ...(boundValues as Parameters<StatementSync["all"]>),
      ) as T[];
      return Promise.resolve({
        results: rows,
        meta: {
          changes: 0,
          last_row_id: 0,
          duration: 0,
          size_after: 0,
          rows_read: 0,
          rows_written: 0,
          changed_db: false,
        },
        success: true,
      } as D1Result<T>);
    },
    raw: <T = unknown[]>(options?: { columnNames?: boolean }) => {
      const rows = nodeSqlStmt.all(
        ...(boundValues as Parameters<StatementSync["all"]>),
      ) as Record<string, unknown>[];
      const values = rows.map((row) => Object.values(row) as T);
      if (options?.columnNames === true) {
        const first = rows.at(0);
        const cols = first === undefined ? [] : Object.keys(first);
        return Promise.resolve([cols, ...values]);
      }
      return Promise.resolve(values);
    },
    first: <T = Record<string, unknown>>(colName?: string) => {
      const rows = nodeSqlStmt.all(
        ...(boundValues as Parameters<StatementSync["all"]>),
      ) as Record<string, unknown>[];
      const first = rows.at(0);
      if (first === undefined) return Promise.resolve(null);
      if (colName !== undefined)
        // eslint-disable-next-line security/detect-object-injection
        return Promise.resolve((first[colName] ?? null) as T | null);
      return Promise.resolve(first as T | null);
    },
  } as unknown as D1PreparedStatement;
  return stmt;
}

export function createTestD1(): D1Database {
  const db = new DatabaseSync(":memory:", {
    enableForeignKeyConstraints: true,
  });

  for (const migrationFile of migrationFiles) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- migration paths from trusted _journal.json
    const migrationSql = readFileSync(migrationFile, "utf8");
    const statements = migrationSql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const statement of statements) {
      db.exec(statement);
    }
  }

  const d1: D1Database = {
    prepare: (sql: string) => {
      const stmt = db.prepare(sql);
      return createMockStatement(stmt, []);
    },
    batch: async (statements: D1PreparedStatement[]) => {
      const results = [];
      for (const s of statements) {
        results.push(await s.all());
      }
      return results;
    },
    exec: (query: string) => {
      db.exec(query);
      return Promise.resolve({ count: 0, duration: 0 });
    },
    withSession: () => {
      throw new Error("withSession not implemented in test helper");
    },
    dump: () => Promise.resolve(new ArrayBuffer(0)),
  } as unknown as D1Database;

  return d1;
}
