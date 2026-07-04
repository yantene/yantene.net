import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { entityId } from "~/backend/domain/shared";
import {
  Email,
  type IUserQueryRepository,
  User,
  type UserId,
} from "~/backend/domain/user";
import { users } from "~/backend/infra/d1/schema";
import { unixToInstant } from "~/backend/infra/d1/temporal";

function rowToUser(row: typeof users.$inferSelect): User {
  return User.reconstruct({
    id: entityId(row.id),
    email: Email.create(row.email),
    displayName: row.displayName,
    createdAt: unixToInstant(row.createdAt),
    updatedAt: unixToInstant(row.updatedAt),
  });
}

export class D1UserQueryRepository implements IUserQueryRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  async findById(id: UserId): Promise<User | undefined> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    const row = rows.at(0);
    return row === undefined ? undefined : rowToUser(row);
  }

  async findByEmail(email: Email): Promise<User | undefined> {
    // Email VO は生成時に小文字へ正規化済みのため、ここで再正規化はしない。
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email.toString()))
      .limit(1);
    const row = rows.at(0);
    return row === undefined ? undefined : rowToUser(row);
  }
}
