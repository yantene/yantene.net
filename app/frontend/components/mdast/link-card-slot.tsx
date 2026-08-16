import { useContext } from "react";
import { LinkCardsContext } from "./link-card-context";
import { LinkCard } from "~/frontend/components/link-card/link-card";
import { isHttpUrl } from "~/lib/http-url";

/**
 * 印のついた要素を実際のカードにする。
 *
 * 中身が見つからないときは素のリンクに戻す。カードにできなかっただけで本文から
 * URL が消えるのは、静かに壊れているのと変わらない。
 *
 * 素のリンクに落とすときは、ここでもう一度スキームを確かめる。**印は本文からも書ける**
 * ため (iframe か audio を含む生 HTML のブロックは丸ごと通るので、そこに `link-card` を
 * 並べれば要素として残る。mdast-renderer.tsx の sanitizeSchema を参照)、href に値を渡す
 * この場所が実質の関門になる。
 */
export function LinkCardSlot({
  url,
}: {
  readonly url?: string;
}): React.JSX.Element {
  const cards = useContext(LinkCardsContext);
  const card = url === undefined ? undefined : cards.get(url);

  if (card === undefined) {
    /*
     * 載せてよい URL でなければ、**リンクの形にしない。** href の無い `<a>` は押せず
     * 焦点も当たらないのに、`target` と `rel` だけを提げた形になる。何であるかを
     * 名乗らせるほうがよい。
     */
    if (url === undefined || !isHttpUrl(url)) {
      return (
        <p>
          <span>{url}</span>
        </p>
      );
    }
    return (
      <p>
        <a
          className="press-control"
          href={url}
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
