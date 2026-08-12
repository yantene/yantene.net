import type { LinkCardView } from "~/backend/handlers/link-cards/link-card-view";

export interface LinkCardProps {
  readonly card: LinkCardView;
}

/** 出どころとして見せる名前。og:site_name が無ければホスト名で代える。 */
function sourceLabelOf(card: LinkCardView): string {
  if (card.siteName !== null) return card.siteName;
  try {
    return new URL(card.url).hostname;
  } catch {
    return card.url;
  }
}

/**
 * 本文にむき出しで置かれた URL の代わりに出すカード。
 *
 * 画像はどちらも自分のところから配る。相手のドメインからは読み込めない
 * (`img-src 'self' data:`) ので、refresh のときに写したものを指している。
 *
 * 見た目の可変軸は持たない。CSP が `style-src 'self'` なので inline style は
 * ブラウザに無視される (ADR 0007)。段階が要るものは CSS のクラスで持つ。
 */
export function LinkCard({ card }: LinkCardProps): React.JSX.Element {
  return (
    <a
      className="link-card press-control"
      href={card.url}
      target="_blank"
      rel="noopener noreferrer nofollow"
    >
      <span className="link-card-body">
        <span className="link-card-title">{card.title}</span>
        {card.description !== null && (
          <span className="link-card-description">{card.description}</span>
        )}
        <span className="link-card-source">
          {card.faviconUrl !== null && (
            <img
              className="link-card-favicon"
              src={card.faviconUrl}
              alt=""
              width={16}
              height={16}
              loading="lazy"
              decoding="async"
            />
          )}
          <span className="link-card-host">{sourceLabelOf(card)}</span>
        </span>
      </span>
      {card.imageUrl !== null && (
        <span className="link-card-thumbnail">
          <img src={card.imageUrl} alt="" loading="lazy" decoding="async" />
        </span>
      )}
    </a>
  );
}
