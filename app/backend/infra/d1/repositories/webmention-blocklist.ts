import { drizzle } from "drizzle-orm/d1";
import type { IWebmentionBlocklist } from "~/backend/domain/webmention";
import { webmentionBlocks } from "~/backend/infra/d1/schema";

/** D1 をバックエンドにした {@link IWebmentionBlocklist} 実装。 */
export class D1WebmentionBlocklist implements IWebmentionBlocklist {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  async listBlockedHosts(): Promise<readonly string[]> {
    const rows = await this.db.select({ host: webmentionBlocks.host }).from(webmentionBlocks);
    return rows.map((row) => row.host);
  }
}
