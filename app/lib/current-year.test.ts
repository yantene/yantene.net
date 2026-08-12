import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { currentYear } from "./current-year";

describe("currentYear", () => {
  it("returns the current year", () => {
    expect(currentYear()).toBe(new Date().getFullYear());
  });
});

/*
 * トップレベルで時計を読んでいないかを、ソースを走査して見張る。
 *
 * Cloudflare Workers は I/O の外 (モジュールのトップレベル評価時) の時刻を Unix epoch 0 に
 * 固定する。そのため `const year = new Date().getFullYear()` のようなモジュールスコープの
 * 時計読みは、ローカルでは正しく動くのに本番の SSR だけ 1970 年になる。しかも画面上は
 * hydration で正しい値に差し替わるため、目で見ても気づけない。
 *
 * 型でも lint でも表せないので、AST で見張る。関数の中は追わない。そこはリクエストの中で
 * 呼ばれうる場所で、時計を読んでよい (currentYear() 自身がそう)。
 */

const clockRoots = ["app", "workers"];

/**
 * 走査対象のソース。
 *
 * テストとストーリーは Workers 上で動かないので除く。素の値を組み立てるために時計を
 * 読むことがあり、そこを咎めても意味がない。
 */
function collectSources(root: string): readonly string[] {
  return (
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- 走査するのは自リポジトリの固定ディレクトリで、外部入力は混ざらない
    readdirSync(root, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => path.join(entry.parentPath, entry.name))
      .filter((file) => /\.tsx?$/.test(file))
      .filter((file) => !/\.(test|stories)\.tsx?$/.test(file))
      .filter((file) => !file.endsWith(".d.ts"))
  );
}

/** 引数なしの `new Date()` / `Date.now()` / `Temporal.Now.*` を時計読みとみなす。 */
function isClockRead(node: ts.Node): boolean {
  if (ts.isNewExpression(node)) {
    // 引数付き (`new Date("2020-01-01")`) は決め打ちの日付なので時計ではない。
    return (
      node.expression.getText() === "Date" &&
      (node.arguments?.length ?? 0) === 0
    );
  }
  if (ts.isPropertyAccessExpression(node)) {
    const text = node.getText();
    return text === "Date.now" || text.startsWith("Temporal.Now.");
  }
  return false;
}

function isFunctionLike(node: ts.Node): boolean {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isGetAccessor(node) ||
    ts.isSetAccessor(node)
  );
}

/** ファイル内の、関数の外で時計を読んでいる箇所を行番号付きで返す。 */
function findTopLevelClockReads(file: string): readonly string[] {
  const source = ts.createSourceFile(
    file,
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- 読むのは collectSources が列挙した自リポジトリのソースだけ
    readFileSync(file, "utf8"),
    ts.ScriptTarget.ESNext,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    // 関数の内側は追わない (リクエストの中で呼ばれうる)。
    if (isFunctionLike(node)) return;
    if (isClockRead(node)) {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart());
      found.push(`${file}:${String(line + 1)} ${node.getText()}`);
      return;
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(source, visit);
  return found;
}

describe("module scope", () => {
  it("never reads the clock outside a function", () => {
    const violations = clockRoots
      .flatMap((root) => collectSources(root))
      .flatMap((file) => findTopLevelClockReads(file));

    expect(violations).toEqual([]);
  });
});
