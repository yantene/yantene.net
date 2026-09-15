export interface TaglineLinesProps {
  /** 短い自己紹介を行に分けたもの。 */
  readonly lines: readonly string[];
  readonly className?: string;
  /**
   * 書かれた改行を畳んで、器の幅まで流すか。
   *
   * **狭い器に押し込むときだけ立てる。** 記事の末尾の筆者紹介がそれで、あそこは
   * 書かれた改行のまま出すと行が 300px で止まり、本文の幅 (768px) に対して
   * 右が大きく余る。区画が器を埋めていないように見えるので、そこだけ流す。
   */
  readonly flow?: boolean;
}

/**
 * 短い自己紹介を、書かれた改行のまま 1 つの段落に描く。
 *
 * 出す場所が 3 つある (トップのヒーロー・`/about` の h-card・記事末尾の筆者紹介) ので、
 * 行の並べ方はここ 1 つに持つ。見た目の差は `className` で吸収する。
 *
 * 改行は `<br />` を挟まず `white-space: pre-line` に任せる。行を要素に分けると
 * 1 つずつ key が要るが、行の中身は一意とは限らず (空行を挟んだ 2 段落の自己紹介が
 * それにあたる)、位置を key にするのは並べ替えに弱い書き方として避けたい。
 * 段落 1 つにテキストを流し込めば、どちらの悩みも持たなくて済む。
 */
export function TaglineLines({
  lines,
  className,
  flow = false,
}: TaglineLinesProps): React.JSX.Element {
  /*
   * 流すときは行を空白で繋ぐ。`white-space` を切り替えるだけだと、改行が
   * 畳まれるかどうかがブラウザの既定に委ねられる (`normal` は改行を空白として
   * 扱うが、そこに頼ると CSS を触った人が意図せず崩せる)。
   */
  if (flow) return <p className={className}>{lines.join(" ")}</p>;

  return <p className={`whitespace-pre-line ${className ?? ""}`}>{lines.join("\n")}</p>;
}
