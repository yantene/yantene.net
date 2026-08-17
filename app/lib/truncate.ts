/**
 * 文字列を**書記素**で数えて切り詰める。
 *
 * UTF-16 の符号単位 (`String.prototype.slice`) で切ると、絵文字や拡張漢字が半分に割れて
 * 豆腐になる。code point で切ると、異体字選択子や ZWJ で結合された絵文字がばらける。
 * どちらも切り口が当たったときだけ起きるので、相手任せの文字列では避けようがない。
 *
 * 区切りを毎回作り直しているのは、切り詰めが走るのが外から来た文字列を蓄えるときと、
 * R2 に蓄えの無い OG カードを描くときだけで、使い回して抱えておくほどの回数にならないため。
 *
 * @param max 返す文字列の書記素の上限。**`ellipsis` の分を含む。**
 * @param options.ellipsis 切り詰めたときに末尾へ足すもの。既定では足さない
 */
export function truncateByGrapheme(
  value: string,
  max: number,
  options: { readonly ellipsis?: string } = {},
): string {
  const graphemes = toGraphemes(value);
  if (graphemes.length <= max) return value;

  const ellipsis = options.ellipsis ?? "";
  // 足すものも書記素で数える。「…」以外を渡されても上限を破らないようにする。
  const room = max - toGraphemes(ellipsis).length;
  if (room <= 0) return ellipsis;

  return `${graphemes.slice(0, room).join("")}${ellipsis}`;
}

function toGraphemes(value: string): readonly string[] {
  return Array.from(
    new Intl.Segmenter("ja").segment(value),
    (segment) => segment.segment,
  );
}
