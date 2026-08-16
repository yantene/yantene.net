import { Link } from "react-router";

/**
 * a 要素: ページ内アンカーだけ React Router の Link に通す。
 *
 * 素の `<a href="#...">` は `<ScrollRestoration>` がブラウザのハッシュジャンプを
 * 打ち消すためスクロールしない (目次が Link を使っているのと同じ理由)。本文で
 * ページ内アンカーになるのは脚注の行き来なので、これが無いと注へ飛べない。
 *
 * 外部・内部リンクは素の `<a>` のまま返す。Router の文脈を要らない場所でも
 * 描けるようにしておくため。
 */
export function Anchor({
  href,
  children,
  ...rest
}: Readonly<React.ComponentPropsWithoutRef<"a">>): React.JSX.Element {
  if (href === undefined || !href.startsWith("#")) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link to={href} {...rest}>
      {children}
    </Link>
  );
}
