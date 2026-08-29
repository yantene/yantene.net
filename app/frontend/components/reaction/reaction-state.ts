/*
 * 押した結果を、往復を待たずに画面へ先に反映するための計算。
 *
 * 描画から切り離してあるのは、数の増減と並び替えの正しさを DOM 無しで確かめられる
 * ようにするため。確定値は loader から降ってくるので、ここが作るのは「送信中に
 * 見えているもの」に限る。
 */

/** 押されている絵文字ひとつぶん。 */
export interface ReactionCount {
  readonly emoji: string;
  readonly count: number;
}

export interface ReactionState {
  readonly reactions: readonly ReactionCount[];
  /** この読み手が押している絵文字。押していなければ null。 */
  readonly mine: string | null;
}

/**
 * 並び順はサーバーに合わせる (多い順、同数なら絵文字の昇順)。
 *
 * 揃えておかないと、送信中と応答後で並びが入れ替わって見える。厳密には SQLite の
 * バイト順とここの文字列比較は補助面の外で食い違いうるが、確定値は応答で上書きされる
 * ので、送信中の見た目が一瞬ずれる以上のことは起きない。
 */
function sorted(reactions: readonly ReactionCount[]): readonly ReactionCount[] {
  return reactions.toSorted((a, b) => {
    if (a.count !== b.count) return b.count - a.count;
    return a.emoji.localeCompare(b.emoji);
  });
}

/** 0 になった絵文字は並べない (サーバーの一覧も 0 を返さない)。 */
function withCount(
  reactions: readonly ReactionCount[],
  emoji: string,
  delta: number,
): readonly ReactionCount[] {
  const found = reactions.find((reaction) => reaction.emoji === emoji);
  const next = Math.max((found?.count ?? 0) + delta, 0);
  const others = reactions.filter((reaction) => reaction.emoji !== emoji);

  return next === 0 ? others : [...others, { emoji, count: next }];
}

/**
 * 送信中の内容を先に反映した姿を返す。
 *
 * 1 ノートにつき 1 人 1 つなので、押すことは「いまの 1 つを置き換える」ことになる。
 * 旧を減らして新を増やす。
 *
 * @param pending 押そうとしている絵文字。null なら取り消し。
 */
export function withPendingReaction(current: ReactionState, pending: string | null): ReactionState {
  if (current.mine === pending) return current;

  const removed =
    current.mine === null ? current.reactions : withCount(current.reactions, current.mine, -1);
  const added = pending === null ? removed : withCount(removed, pending, 1);

  return { reactions: sorted(added), mine: pending };
}
