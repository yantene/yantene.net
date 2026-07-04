import { Temporal } from "@js-temporal/polyfill";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { entityId, type IUnpersisted } from "~/backend/domain/shared";
import {
  DuplicateEmailError,
  type IUserCommandRepository,
  User,
  type UserId,
} from "~/backend/domain/user";
import { users } from "~/backend/infra/d1/schema";
import { instantToUnix } from "~/backend/infra/d1/temporal";

/**
 * SQLite (D1) の UNIQUE 制約違反かどうかを判定する。
 * drizzle は元エラーを "Failed query: ..." でラップするため、cause チェーンを辿る。
 */
function isUniqueConstraintViolation(error: unknown): boolean {
  let current: unknown = error;
  while (current instanceof Error) {
    if (/UNIQUE constraint failed/i.test(current.message)) return true;
    current = current.cause;
  }
  return false;
}

export class D1UserCommandRepository implements IUserCommandRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  async save(user: User<IUnpersisted>): Promise<User> {
    const id = crypto.randomUUID();
    const now = Temporal.Now.instant();
    const row = {
      id,
      email: user.email.toString(),
      displayName: user.displayName,
      createdAt: instantToUnix(now),
      updatedAt: instantToUnix(now),
    };
    try {
      await this.db.insert(users).values(row);
    } catch (error) {
      // email の UNIQUE 制約違反はドメインエラーへ翻訳する (インフラの語彙を漏らさない)。
      if (isUniqueConstraintViolation(error)) {
        throw new DuplicateEmailError(user.email.toString());
      }
      throw error;
    }
    return User.reconstruct({
      id: entityId(id),
      email: user.email,
      displayName: user.displayName,
      createdAt: now,
      updatedAt: now,
    });
  }

  async delete(id: UserId): Promise<void> {
    await this.db.delete(users).where(eq(users.id, id));
  }
}
