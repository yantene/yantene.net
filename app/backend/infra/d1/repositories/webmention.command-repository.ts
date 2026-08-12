import { Temporal } from "@js-temporal/polyfill";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { rowToWebmention } from "./webmention-row";
import type { NoteId } from "~/backend/domain/note";
import type { IUnpersisted } from "~/backend/domain/shared";
import type {
  IWebmentionCommandRepository,
  Webmention,
  WebmentionUrl,
} from "~/backend/domain/webmention";
import { webmentions } from "~/backend/infra/d1/schema";
import { instantToUnix } from "~/backend/infra/d1/temporal";

export class D1WebmentionCommandRepository implements IWebmentionCommandRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  /**
   * (ノート, source) をキーに upsert する。
   *
   * 再送で更新される仕様なので、読んでから分岐せず 1 手で置く。received_at は
   * insert のときだけ入り、更新では触らない (初めて受け取った時刻を残すため)。
   */
  async upsert(webmention: Webmention<IUnpersisted>): Promise<Webmention> {
    const nowUnix = instantToUnix(Temporal.Now.instant());
    const content = {
      target: webmention.target.toString(),
      type: webmention.type.toString(),
      authorName: webmention.author.name ?? null,
      authorUrl: webmention.author.url?.toString() ?? null,
      authorPhoto: webmention.author.photo?.toString() ?? null,
      content: webmention.content?.toString() ?? null,
      publishedAt:
        webmention.publishedAt === undefined
          ? null
          : instantToUnix(webmention.publishedAt),
      updatedAt: nowUnix,
    };

    const rows = await this.db
      .insert(webmentions)
      .values({
        id: crypto.randomUUID(),
        noteId: webmention.noteId,
        source: webmention.source.toString(),
        receivedAt: nowUnix,
        ...content,
      })
      .onConflictDoUpdate({
        target: [webmentions.noteId, webmentions.source],
        set: content,
      })
      .returning();

    // 分割代入だと型の上では必ず取れることになってしまうので、at で受けて確かめる。
    const row = rows.at(0);
    if (row === undefined) {
      throw new Error("Webmention upsert returned no row");
    }

    return rowToWebmention(row);
  }

  async deleteBySource(noteId: NoteId, source: WebmentionUrl): Promise<void> {
    const row = and(
      eq(webmentions.noteId, noteId),
      eq(webmentions.source, source.toString()),
    );

    await this.db.delete(webmentions).where(row);
  }
}
