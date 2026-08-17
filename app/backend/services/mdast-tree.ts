import type { Nodes } from "mdast";

/**
 * MDAST を写しながら 1 ノードずつ差し替える。**元の木は変えない。**
 *
 * 走査は**葉から根へ**。`visit` が受け取るのは、子を写し終えたあとのノードになる。
 * 親を決めるのに写した子を見たい変換 (引用が Alert かどうかは中身を読んで決まる、
 * 改行の畳み込みは並んだ兄弟をまとめて見る) があるので、この向きに揃えてある。
 * 逆向きにすると、そういう変換だけ自前の再帰に戻ることになる。
 *
 * **触っていない枝は写さない。** `visit` が受け取ったものをそのまま返し、子も 1 つも
 * 変わらなければ、元のノードを同一性ごと返す。1 か所も当たらない木では親の骨組みを
 * 作り直さずに済む。Workers のメモリを考えると、5 通りの変換が順に走るこの経路では
 * 効きが小さくない。
 *
 * @param visit ノードを受け取り、**同じ種別の**ノードを返す。種別を変えると、親が
 *   持てない子を持つ木になる (mdast の型では表せない状態になる)
 */
export function mapTree<T extends Nodes>(
  node: T,
  visit: (node: Nodes) => Nodes,
): T {
  return visit(withMappedChildren(node, visit)) as T;
}

/**
 * 子を差し替えたノード。**1 つも変わっていなければ元のノードをそのまま返す。**
 *
 * 「変わったか」は中身ではなく**同一性**で見る。木を写す変換は変えないノードを
 * そのまま返す約束なので、これで足りるし、深い比較より安い。
 *
 * 子の種別は写しても変わらない前提なので、親の型はそのまま保たれる。この前提が
 * 崩れる (別の種別の子を渡す) と、mdast の型では表せない木になる。
 */
export function withChildren<T extends Nodes>(
  node: T,
  children: readonly Nodes[],
): T {
  if (!("children" in node)) return node;

  /*
   * 一度 Nodes の配列として見る。T が Nodes 全体を渡り歩く形なので、`node.children`
   * の要素型はすべての親が持ちうる子の交差 (= never) に潰れており、そのままだと
   * 「Nodes と never を比べている」ことになって静的解析が止める。
   */
  const previous: readonly Nodes[] = node.children;
  const isUnchanged =
    children.length === previous.length &&
    children.every((child, index) => child === previous.at(index));
  return isUnchanged ? node : { ...node, children };
}

/** 子だけを写したノード。 */
function withMappedChildren<T extends Nodes>(
  node: T,
  visit: (node: Nodes) => Nodes,
): T {
  if (!("children" in node)) return node;
  return withChildren(
    node,
    node.children.map((child) => mapTree(child, visit)),
  );
}
