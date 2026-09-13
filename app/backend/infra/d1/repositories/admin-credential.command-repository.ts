import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { credentialToRow } from "./admin-credential-row";
import type {
  AdminCredential,
  CredentialId,
  IAdminCredentialCommandRepository,
} from "~/backend/domain/admin";
import { CredentialAlreadyRegisteredError } from "~/backend/domain/admin";
import { adminCredentials } from "~/backend/infra/d1/schema";

export class D1AdminCredentialCommandRepository implements IAdminCredentialCommandRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  /**
   * 新しい資格情報を入れる。
   *
   * **すでに同じ id があれば送出する。** upsert にすると、登録の儀式を通せる人が
   * 既存の鍵の公開鍵を差し替えられる。入口は守っているが、差し替えを「更新」として
   * 受け入れる口をわざわざ開けない。
   */
  async add(credential: AdminCredential): Promise<void> {
    const inserted = await this.db
      .insert(adminCredentials)
      .values(credentialToRow(credential))
      .onConflictDoNothing({ target: adminCredentials.id })
      .returning({ id: adminCredentials.id });

    if (inserted.length === 0) {
      throw new CredentialAlreadyRegisteredError("this credential is already registered");
    }
  }

  /** 使用回数と最終使用時刻を書き戻す。公開鍵と算法は動かさない。 */
  async save(credential: AdminCredential): Promise<void> {
    const row = credentialToRow(credential);
    await this.db
      .update(adminCredentials)
      .set({ signCount: row.signCount, lastUsedAt: row.lastUsedAt, label: row.label })
      .where(eq(adminCredentials.id, row.id));
  }

  async remove(id: CredentialId): Promise<void> {
    await this.db.delete(adminCredentials).where(eq(adminCredentials.id, id.toString()));
  }
}
