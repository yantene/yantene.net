import { HiLink } from "react-icons/hi2";
import { Link } from "react-router";

interface HeadingLinkProps {
  /** 行き先の見出しの id。rehype-slug が振ったものを hast 経由で受け取る。 */
  readonly anchor?: string;
}

/**
 * 見出しの頭に置く、その見出し自身へのリンク。
 *
 * 節の在り処を URL として持ち帰るためのもの。以前は `##` / `###` の字を出していたが、
 * 見出しの太さと大きさに引きずられて本文より先に目に入ったのでやめた (#441)。字を持たない
 * アイコンなら、見出しの組みに影響しない大きさで置ける。
 *
 * 読み上げにも焦点の順にも出さない。字を持たないリンクなので名前を与えないと使えない
 * ものになるが、名前を付けたところで見出しごとに「〜へのリンク」が並ぶだけで、見出し
 * そのものを辿れる支援技術には要らない。
 *
 * react-router の Link に通すのは、素の `<a href="#...">` だと `<ScrollRestoration>` が
 * ブラウザのハッシュジャンプを打ち消してスクロールしないため。
 */
export function HeadingLink({ anchor }: HeadingLinkProps): React.JSX.Element | null {
  // 行き先が無ければ描かない (rehype-slug は字を持たない見出しに id を振らない)。
  if (anchor === undefined || anchor === "") return null;

  return (
    <Link to={`#${anchor}`} className="heading-link" aria-hidden="true" tabIndex={-1}>
      <HiLink className="heading-link-icon" />
    </Link>
  );
}
