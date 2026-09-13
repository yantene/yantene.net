import { count, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { rowToCredential } from "./admin-credential-row";
import type {
  AdminCredential,
  CredentialId,
  IAdminCredentialQueryRepository,
} from "~/backend/domain/admin";
import { adminCredentials } from "~/backend/infra/d1/schema";

export class D1AdminCredentialQueryRepository implements IAdminCredentialQueryRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  async findById(id: CredentialId): Promise<AdminCredential | undefined> {
    const rows = await this.db
      .select()
      .from(adminCredentials)
      .where(eq(adminCredentials.id, id.toString()))
      .limit(1);
    const row = rows.at(0);
    return row === undefined ? undefined : rowToCredential(row);
  }

  /** 登録が古い順。管理画面の一覧に出す。 */
  async list(): Promise<readonly AdminCredential[]> {
    const rows = await this.db.select().from(adminCredentials).orderBy(adminCredentials.createdAt);
    return rows.map((row) => rowToCredential(row));
  }

  /**
   * 登録済みの本数。
   *
   * 鍵そのものを読み出さずに数だけを引く。登録の入口を開けてよいかの判定にしか
   * 使わないので、判定のために公開鍵を持ち回らない。
   */
  async count(): Promise<number> {
    const rows = await this.db.select({ total: count() }).from(adminCredentials);
    return rows.at(0)?.total ?? 0;
  }
}
