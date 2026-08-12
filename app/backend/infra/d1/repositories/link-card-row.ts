import { LinkCard, LinkCardUrl } from "~/backend/domain/link-card";
import { unixToInstant } from "~/backend/infra/d1/temporal";

/** link_cards の 1 行 (drizzle の select 結果)。 */
export interface LinkCardRow {
  readonly id: string;
  readonly url: string;
  readonly title: string | null;
  readonly description: string | null;
  readonly siteName: string | null;
  readonly hasImage: number;
  readonly hasFavicon: number;
  readonly fetchedAt: number;
}

/**
 * 行をエンティティに戻す。
 *
 * title が NULL の行は「取りに行ったが取れなかった」を表す。中身のあるカードと
 * 同じ型で扱い、描き分けはエンティティの isAvailable に任せる。
 */
export function toLinkCard(row: LinkCardRow): LinkCard {
  const url = LinkCardUrl.create(row.url);
  const fetchedAt = unixToInstant(row.fetchedAt);

  if (row.title === null) {
    return LinkCard.unavailable({ id: row.id, url, fetchedAt });
  }

  return LinkCard.available({
    id: row.id,
    url,
    metadata: {
      title: row.title,
      description: row.description ?? undefined,
      siteName: row.siteName ?? undefined,
      hasImage: row.hasImage !== 0,
      hasFavicon: row.hasFavicon !== 0,
    },
    fetchedAt,
  });
}
