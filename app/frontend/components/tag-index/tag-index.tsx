import { Link } from "react-router";

export interface TagIndexItem {
  readonly tag: string;
  readonly count: number;
}

interface TagIndexProps {
  readonly tags: readonly TagIndexItem[];
  /** いま絞り込んでいるタグ (未絞り込みなら null)。 */
  readonly selected: string | null;
  /** 併用中の検索語。タグを選んでも検索語が外れないよう持ち回す。 */
  readonly query?: string;
}

/**
 * 検索欄に添えるタグの索引。
 *
 * 記事数で字の大きさを変えるタグクラウドにはしない。タグが十数個ある程度では雲にならず、
 * 大小がばらつくだけで読みにくくなる。ここでは横一列に並べ、記事数は小さく添えるに留める。
 *
 * 選んでいるタグをもう一度押すと外れる (トグル)。絞り込みを解くための別の導線を
 * 置かなくて済む。
 */
export function TagIndex({ tags, selected, query = "" }: TagIndexProps): React.JSX.Element {
  const hrefFor = (tag: string): string => {
    const params = new URLSearchParams();
    if (query.length > 0) params.set("q", query);
    // 選択中のタグを押したら外す。
    if (tag !== selected) params.set("tag", tag);
    const search = params.toString();
    return search.length > 0 ? `/notes?${search}` : "/notes";
  };

  return (
    <ul className="tag-index">
      {tags.map(({ tag, count }) => (
        <li key={tag}>
          <Link
            to={hrefFor(tag)}
            className="tag-index-item press-control"
            aria-current={tag === selected ? "true" : undefined}
          >
            {tag}
            <span className="tag-index-count">{count}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
