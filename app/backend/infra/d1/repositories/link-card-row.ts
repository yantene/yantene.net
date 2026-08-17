import type { LinkCardImageState } from "~/backend/domain/link-card";
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
  readonly imageMissed: number;
  readonly hasFavicon: number;
  readonly fetchFailedSince: number | null;
  readonly fetchedAt: number;
}

/**
 * 2 つの列を 1 つの状態に畳む。
 *
 * 書くときは必ずどちらか一方だけを立てるので両方立った行は無いが、写しがあるなら
 * それが事実なので、has_image を先に見る。
 */
function toImageState(row: LinkCardRow): LinkCardImageState {
  if (row.hasImage !== 0) return "stored";
  if (row.imageMissed !== 0) return "missed";
  return "absent";
}

/**
 * 行をエンティティに戻す。
 *
 * title が NULL の行は「取りに行ったが取れなかった」を表す。中身のあるカードと
 * 同じ型で扱い、描き分けはエンティティの isAvailable に任せる。
 *
 * 状態は 2 つの列の組で決まる。**この対応は全域で、どの組にも行き先がある。**
 *
 * | title    | fetch_failed_since | 状態                             |
 * | -------- | ------------------ | -------------------------------- |
 * | NULL     | (常に NULL)        | 取れなかった。素のリンクに落ちる |
 * | NOT NULL | NULL               | 取れた                           |
 * | NOT NULL | NOT NULL           | 前回の中身を持ちこたえている     |
 */
export function toLinkCard(row: LinkCardRow): LinkCard {
  const url = LinkCardUrl.create(row.url);
  const fetchedAt = unixToInstant(row.fetchedAt);

  if (row.title === null) {
    return LinkCard.unavailable({ id: row.id, url, fetchedAt });
  }

  const params = {
    id: row.id,
    url,
    metadata: {
      title: row.title,
      description: row.description ?? undefined,
      siteName: row.siteName ?? undefined,
      image: toImageState(row),
      hasFavicon: row.hasFavicon !== 0,
    },
    fetchedAt,
  };
  if (row.fetchFailedSince === null) return LinkCard.available(params);

  // 中身は在るが直近の取得は失敗した、という行。見せるのは前回のままで、取り直しは早める。
  return LinkCard.keptAfterFailure({
    ...params,
    fetchFailedSince: unixToInstant(row.fetchFailedSince),
  });
}
