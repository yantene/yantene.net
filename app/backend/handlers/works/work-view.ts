import type { Work } from "~/backend/domain/work";

/**
 * 2 か所 (`/about` と `/works`) が共通で出す作品。
 *
 * 詳しい説明 (MDAST) はここに含めない。読むのは `/works/<slug>` だけなので、一覧を
 * 開くたびに全件ぶんを運ぶ理由が無い。
 */
export interface PublicWork {
  readonly slug: string;
  readonly name: string;
  readonly summary: string;
  /** 作品そのものの在り処。外に出していなければ null。 */
  readonly url: string | null;
}

export function toPublicWork(work: Work): PublicWork {
  return {
    slug: work.slug.toJSON(),
    name: work.name.toJSON(),
    summary: work.summary.toJSON(),
    url: work.url?.toJSON() ?? null,
  };
}
