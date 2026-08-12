import type { webmentions } from "~/backend/infra/d1/schema";
import { NoteSlug } from "~/backend/domain/note";
import { entityId } from "~/backend/domain/shared";
import {
  Webmention,
  WebmentionAuthor,
  WebmentionContent,
  WebmentionType,
  WebmentionUrl,
} from "~/backend/domain/webmention";
import { unixToInstant } from "~/backend/infra/d1/temporal";

/**
 * D1 の行を Webmention エンティティに復元する。Command / Query リポジトリで共有する。
 *
 * source / type は保存時に VO を通しているので、ここでの再検証は破損データの検知を
 * 兼ねる (不正なら VO factory が throw する)。著者の URL だけは例外で、読めなければ
 * 落として名前だけ残す (欠けても Webmention としては成立するため)。
 */
export function rowToWebmention(
  row: typeof webmentions.$inferSelect,
): Webmention {
  return Webmention.reconstruct({
    id: entityId<"Webmention">(row.id),
    noteId: entityId<"Note">(row.noteId),
    target: NoteSlug.create(row.target),
    source: WebmentionUrl.create(row.source),
    type: WebmentionType.create(row.type),
    author: WebmentionAuthor.reconstruct({
      name: row.authorName,
      url: row.authorUrl,
      photo: row.authorPhoto,
    }),
    content:
      row.content === null
        ? undefined
        : WebmentionContent.fromText(row.content),
    publishedAt:
      row.publishedAt === null ? undefined : unixToInstant(row.publishedAt),
    receivedAt: unixToInstant(row.receivedAt),
    updatedAt: unixToInstant(row.updatedAt),
  });
}
