import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { gitBlobHash, isLoopback, listWorkingTree, readContentFile } from "./content-bridge.ts";

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

describe("content bridge", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "content-bridge-"));
    git(root, "init", "-q");
    mkdirSync(join(root, "articles"));
    mkdirSync(join(root, ".violet"));
    writeFileSync(join(root, ".gitignore"), ".violet/\n");
    writeFileSync(join(root, "articles/committed.md"), "# committed\n");
    writeFileSync(join(root, "articles/removed.md"), "# removed\n");
    git(root, "add", ".");
    git(root, "-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-qm", "init");
    rmSync(join(root, "articles/removed.md"));
    writeFileSync(join(root, "articles/new-draft.md"), "# draft\n");
    writeFileSync(join(root, ".violet/new-draft.log"), "verbatim answers\n");
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("hashes like git (the same value Artifacts returns)", () => {
    const bytes = new TextEncoder().encode("# committed\n");
    expect(gitBlobHash(bytes)).toBe(git(root, "rev-parse", "HEAD:articles/committed.md"));
  });

  it("lists uncommitted files, drops deleted and ignored ones", () => {
    expect(listWorkingTree(root)).toStrictEqual([
      ".gitignore",
      "articles/committed.md",
      "articles/new-draft.md",
    ]);
  });

  it("reads only listed paths", () => {
    expect(readContentFile(root, "articles/new-draft.md")).toBeDefined();
    expect(readContentFile(root, ".violet/new-draft.log")).toBeUndefined();
    expect(readContentFile(root, "../etc/passwd")).toBeUndefined();
    expect(readContentFile(root, "articles/removed.md")).toBeUndefined();
  });

  it("answers only the local machine", () => {
    expect(isLoopback("127.0.0.1")).toBe(true);
    expect(isLoopback("::1")).toBe(true);
    expect(isLoopback("::ffff:127.0.0.1")).toBe(true);
    expect(isLoopback("192.168.1.10")).toBe(false);
    expect(isLoopback(undefined)).toBe(false);
  });
});
