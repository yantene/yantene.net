import { describe, expect, it } from "vitest";
import { mapTree } from "./mdast-tree";
import type { Nodes, Root } from "mdast";

function root(): Root {
  return {
    type: "root",
    children: [
      {
        type: "paragraph",
        children: [
          { type: "text", value: "あ" },
          { type: "emphasis", children: [{ type: "text", value: "い" }] },
        ],
      },
      {
        type: "blockquote",
        children: [{ type: "paragraph", children: [{ type: "text", value: "う" }] }],
      },
    ],
  };
}

/** 木の中のテキストを並べる。 */
function textsOf(node: Nodes): string[] {
  if (node.type === "text") return [node.value];
  if (!("children" in node)) return [];
  return node.children.flatMap((child) => textsOf(child));
}

describe("mapTree", () => {
  it("すべてのノードを訪ねる", () => {
    const seen: string[] = [];

    mapTree(root(), (node) => {
      seen.push(node.type);
      return node;
    });

    expect(seen).toEqual([
      "text",
      "text",
      "emphasis",
      "paragraph",
      "text",
      "paragraph",
      "blockquote",
      "root",
    ]);
  });

  /*
   * 葉から根へ。親を決めるのに写した子を見たい変換 (引用が Alert かどうか、
   * 兄弟をまたぐ改行の畳み込み) があるので、この向きでなければならない。
   */
  it("子を写してから親を渡す", () => {
    // 段落に着いた時点で中身がどう見えていたかを控えておき、判定は外でする。
    const seenInParagraphs: string[][] = [];

    const tree = mapTree(root(), (node) => {
      if (node.type === "text") return { ...node, value: `${node.value}!` };
      if (node.type === "paragraph") seenInParagraphs.push(textsOf(node));
      return node;
    });

    // 既に写し終えた子が見えている。
    expect(seenInParagraphs).toEqual([["あ!", "い!"], ["う!"]]);
    expect(textsOf(tree)).toEqual(["あ!", "い!", "う!"]);
  });

  it("元の木を変えない", () => {
    const original = root();
    const snapshot = structuredClone(original);

    mapTree(original, (node) => (node.type === "text" ? { ...node, value: "変" } : node));

    expect(original).toEqual(snapshot);
  });

  /*
   * 1 か所も当たらない木で親の骨組みを作り直さない。5 通りの変換が順に走る経路なので、
   * 触っていない枝を共有できる意味は小さくない。
   */
  it("何も変えなければ元のノードをそのまま返す", () => {
    const original = root();

    const mapped = mapTree(original, (node) => node);

    expect(mapped).toBe(original);
  });

  it("変えた枝だけを写し、触っていない枝は共有する", () => {
    const original = root();

    const mapped = mapTree(original, (node) =>
      node.type === "blockquote" ? { ...node, children: [] } : node,
    );

    expect(mapped).not.toBe(original);
    // 引用は差し替わった。
    expect(mapped.children.at(1)).not.toBe(original.children.at(1));
    // 段落は触っていないので、同じものが入っている。
    expect(mapped.children.at(0)).toBe(original.children.at(0));
  });

  it("葉だけの木でも動く", () => {
    const leaf: Nodes = { type: "text", value: "あ" };

    const mapped = mapTree(leaf, (node) =>
      node.type === "text" ? { ...node, value: "い" } : node,
    );

    expect(mapped.value).toBe("い");
  });

  it("子が空でも動く", () => {
    const empty: Root = { type: "root", children: [] };

    expect(mapTree(empty, (node) => node)).toBe(empty);
  });
});
