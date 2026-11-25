import { describe, expect, it } from "vitest";
import routes from "~/frontend/routes";

/*
 * どのページにもスキップリンクの行き先があること。
 *
 * スキップリンクは AppLayout が全ページに置くが、行き先の `<main id="main-content">` は
 * 各ページが描く。どこか 1 つのページで素の `<main>` を書くと、そのページでだけリンクが
 * どこへも行かなくなる。画面には何も出ないので、気づく手立てがここにしか無い。
 *
 * 描画して確かめるには、ページごとに loader の返す値を揃えることになる。ここで見たいのは
 * 「器を通しているか」という配線だけなので、ソースを読んで見る (json-ld-wiring.test.ts と
 * 同じく、ルートを足せば自動で対象に入る)。
 */
const sources = import.meta.glob<string>(["./*.tsx", "!./*.test.tsx"], {
  query: "?raw",
  import: "default",
  eager: true,
});

function sourceOf(file: string): string {
  const source = sources[`./${file.replace(/^routes\//, "")}`];
  if (source === undefined) throw new Error(`${file} is not found`);
  return source;
}

describe("スキップリンクの行き先", () => {
  it.each(routes.map((entry) => entry.file))("%s は本文を MainContent で描く", (file) => {
    const source = sourceOf(file);

    // スキップリンクを置くのは AppLayout。通していなければリンクそのものが無い。
    expect(source).toContain("<AppLayout");
    expect(source).toContain("<MainContent");
    // 素の <main> は id を持たないので、行き先にならない。
    expect(source).not.toMatch(/<main[\s>]/);
  });
});
