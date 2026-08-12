import type { LinkCard } from "./link-card.entity";

export interface ILinkCardCommandRepository {
  /** カードを書き込む。同じ URL の行があれば置き換える。 */
  upsert(card: LinkCard): Promise<void>;
}
