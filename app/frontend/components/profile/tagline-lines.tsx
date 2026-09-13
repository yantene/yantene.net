export interface TaglineLinesProps {
  /** 短い自己紹介を行に分けたもの。 */
  readonly lines: readonly string[];
  readonly className?: string;
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
export function TaglineLines({ lines, className }: TaglineLinesProps): React.JSX.Element {
  return <p className={`whitespace-pre-line ${className ?? ""}`}>{lines.join("\n")}</p>;
}
