import type { LinkCard } from "~/backend/domain/link-card";

/**
 * カードとして公開する形。
 *
 * 画像は相手のドメインではなく自分の配信 URL を指す (`img-src 'self' data:` なので
 * 相手から直接は読み込めない)。id を外に出すのは、この URL を組み立てるためだけ。
 */
export interface LinkCardView {
  readonly url: string;
  readonly title: string;
  readonly description: string | null;
  readonly siteName: string | null;
  readonly imageUrl: string | null;
  readonly faviconUrl: string | null;
}

/** 本文の URL をキーにしたカードの表。描画側はこの表を引くだけでよい。 */
export type LinkCardMap = Readonly<Record<string, LinkCardView>>;

function assetUrl(id: string, kind: "image" | "favicon"): string {
  return `/api/v1/link-cards/${id}/${kind}`;
}

/**
 * カードを公開形に直す。取得できなかったカードは undefined を返す。
 *
 * 取れなかったことは D1 に残るが、外には出さない。描画側は表に無い URL を素のリンクの
 * まま描くので、「取れなかった」と「まだ取っていない」を区別する必要がない。
 */
export function toLinkCardView(card: LinkCard): LinkCardView | undefined {
  const metadata = card.metadata;
  if (metadata === undefined) return undefined;

  return {
    url: card.url.toString(),
    title: metadata.title,
    description: metadata.description ?? null,
    siteName: metadata.siteName ?? null,
    imageUrl: metadata.image === "stored" ? assetUrl(card.id, "image") : null,
    faviconUrl: metadata.hasFavicon ? assetUrl(card.id, "favicon") : null,
  };
}

/** カードの並びを URL 引きの表にする。 */
export function toLinkCardMap(cards: readonly LinkCard[]): LinkCardMap {
  const entries: [string, LinkCardView][] = [];
  for (const card of cards) {
    const view = toLinkCardView(card);
    if (view !== undefined) entries.push([view.url, view]);
  }
  return Object.fromEntries(entries);
}
