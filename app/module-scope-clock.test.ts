import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * モジュールスコープ (I/O の外) で時計を読んでいないかを、app / workers のソース全体に対して見張る。
 *
 * Cloudflare Workers は I/O の外の時刻を Unix epoch 0 に固定する。そのためトップレベルで
 * 求めた「いまの時刻」は本番でだけ 1970 年になり、ローカルの workerd では再現しない。
 * 実際にフッターの著作権表示が全ページで `© 1970` になり、hydration mismatch まで
 * 起こしていた (#156)。同じ罠はフッターに限らないので、置き場所ではなく書き方で止める。
 *
 * 時刻が要るなら loader・ハンドラ・関数の中 (呼ばれたときに走る場所) で読むこと。
 */

/** 見張る対象。テスト・ストーリーは Workers の上で動かないので外す。 */
const sources = {
  ...import.meta.glob<string>(
    [
      "./**/*.ts",
      "./**/*.tsx",
      "!./**/*.test.ts",
      "!./**/*.test.tsx",
      "!./**/*.stories.tsx",
      "!./**/*.d.ts",
    ],
    { query: "?raw", import: "default", eager: true },
  ),
  ...import.meta.glob<string>("../workers/**/*.ts", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
};

/** 呼ばれたときに初めて走る場所。トップレベル評価では動かないので中は見ない。 */
const deferredKinds: ReadonlySet<ts.SyntaxKind> = new Set([
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.FunctionExpression,
  ts.SyntaxKind.ArrowFunction,
  ts.SyntaxKind.MethodDeclaration,
  ts.SyntaxKind.Constructor,
  ts.SyntaxKind.GetAccessor,
  ts.SyntaxKind.SetAccessor,
]);

function isDeferred(node: ts.Node): boolean {
  if (deferredKinds.has(node.kind)) return true;

  // クラスのインスタンスフィールドは new された時点で走る (static は定義時なので見張る)。
  return (
    ts.isPropertyDeclaration(node) &&
    (ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Static) === 0
  );
}

/** `foo.bar.baz` のような参照を文字列にする。呼び出し先の判定に使う。 */
function accessPath(node: ts.Expression): string {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node)) {
    return `${accessPath(node.expression)}.${node.name.text}`;
  }
  return "";
}

/** 時計を読む式か。引数付きの `new Date("2026-01-15")` は決め打ちの日時なので含めない。 */
function isClockRead(node: ts.Node): boolean {
  if (ts.isNewExpression(node)) {
    return accessPath(node.expression) === "Date" && (node.arguments?.length ?? 0) === 0;
  }
  if (ts.isCallExpression(node)) {
    const path = accessPath(node.expression);
    return path === "Date.now" || path.startsWith("Temporal.Now.");
  }
  return false;
}

/** そのソースがトップレベルで時計を読んでいる箇所を `path:line` で返す。 */
function moduleScopeClockReads(path: string, source: string): string[] {
  const sourceFile = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    false,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const reads: string[] = [];
  const visit = (node: ts.Node): void => {
    if (isDeferred(node)) return;
    if (isClockRead(node)) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      reads.push(`${path}:${String(line + 1)}`);
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);

  return reads;
}

describe("モジュールスコープで時計を読まない", () => {
  it("app / workers のどのモジュールもトップレベルで現在時刻を読まない", () => {
    const reads = Object.entries(sources).flatMap(([path, source]) =>
      moduleScopeClockReads(path, source),
    );

    expect(reads).toEqual([]);
  });

  it("見張る対象を実際に読み込めている", () => {
    // glob が空振りしていると上の検査が黙って素通りするため、代表的なソースを名指しで確かめる。
    expect(Object.keys(sources)).toContain("./frontend/components/layout/footer.tsx");
    expect(Object.keys(sources)).toContain("../workers/app.ts");
  });

  it("トップレベルの時計読みを見つけられる", () => {
    // 見張り自体が壊れたら上の検査は常に通ってしまうので、検出できることを固定する。
    expect(moduleScopeClockReads("sample.ts", "const year = new Date().getFullYear();")).toEqual([
      "sample.ts:1",
    ]);
    expect(moduleScopeClockReads("sample.ts", "const now = Date.now();")).toEqual(["sample.ts:1"]);
    expect(moduleScopeClockReads("sample.ts", "const d = Temporal.Now.instant();")).toEqual([
      "sample.ts:1",
    ]);
  });

  it("関数の中と決め打ちの日時は見逃す", () => {
    expect(
      moduleScopeClockReads(
        "sample.ts",
        "export function year(): number { return new Date().getFullYear(); }",
      ),
    ).toEqual([]);
    expect(moduleScopeClockReads("sample.ts", 'const epoch = new Date("1970-01-01");')).toEqual([]);
  });
});
