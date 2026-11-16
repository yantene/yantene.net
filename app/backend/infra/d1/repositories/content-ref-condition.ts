import { type SQL, and, eq } from "drizzle-orm";
import type { ContentRef } from "~/backend/domain/shared";
import type { contentReactions, contentViews } from "~/backend/infra/d1/schema";

/**
 * 種別と id の対で行を絞る条件。
 *
 * id は種別ごとの表で振られるので、content_id だけで絞ると別の種別の行に当たりうる。
 * 絞り方を 1 か所に置いて、片方だけで引く書き方を作らせない。
 */
export function pointsAt(
  table: typeof contentReactions | typeof contentViews,
  content: ContentRef,
): SQL | undefined {
  return and(eq(table.kind, content.kind), eq(table.contentId, content.id));
}

/**
 * 旧い表 (`article_reactions` と `articles` の列) で、同じものを指す記事の id。
 *
 * ⚠️ **移行のあいだだけ要る。** 新しい表へ移している途中で、書き込みは新旧の両方に
 * 入れている (#566)。旧い表を落とすときに、これを呼んでいる書き込みごと消す。
 *
 * 旧い表には記事しか入らない。種別が増えたら、ここで型が通らなくなる。
 */
export function legacyArticleId(content: ContentRef): string {
  switch (content.kind) {
    case "article": {
      return content.id;
    }
  }
}
