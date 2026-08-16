import { useContext } from "react";
import { isExternalHref } from "./href";
import { LinkCardsContext } from "./link-card-context";
import { LinkCard } from "~/frontend/components/link-card/link-card";

/**
 * 印のついた要素を実際のカードにする。
 *
 * 中身が見つからないときは素のリンクに戻す。カードにできなかっただけで本文から
 * URL が消えるのは、静かに壊れているのと変わらない。
 *
 * 素のリンクに落とすときは、ここでもう一度スキームを確かめる。印を付けるのは
 * こちら側 (linkCardParagraph) だけで、そこは http(s) しか通していないが、
 * href に値を渡す場所で二度目の関門を持たせておく。
 */
export function LinkCardSlot({
  url,
}: {
  readonly url?: string;
}): React.JSX.Element {
  const cards = useContext(LinkCardsContext);
  const card = url === undefined ? undefined : cards.get(url);

  if (card === undefined) {
    const href = url !== undefined && isExternalHref(url) ? url : undefined;
    return (
      <p>
        <a
          className="press-control"
          href={href}
          target="_blank"
          rel="noopener noreferrer nofollow"
        >
          {url}
        </a>
      </p>
    );
  }
  return <LinkCard card={card} />;
}
