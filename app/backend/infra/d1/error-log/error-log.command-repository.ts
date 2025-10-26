import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { IErrorLogCommandRepository } from "../../../domain/error-log/error-log.command-repository.interface";
import { ErrorLog } from "../../../domain/error-log/error-log.entity";
import { LogLevel } from "../../../domain/error-log/log-level.vo";
import type { IPersisted } from "../../../domain/persisted.interface";
import type { IUnpersisted } from "../../../domain/unpersisted.interface";
import { errorLogs } from "../schema";

export class ErrorLogCommandRepository implements IErrorLogCommandRepository {
  constructor(private readonly db: DrizzleD1Database) {}

  async save(errorLog: ErrorLog<IUnpersisted>): Promise<ErrorLog<IPersisted>> {
    const id = crypto.randomUUID();
    const data = {
      id,
      level: errorLog.level.value,
      message: errorLog.message,
      stack: errorLog.stack ?? undefined,
      context: errorLog.context ?? undefined,
    };

    const result = await this.db
      .insert(errorLogs)
      .values(data)
      .returning()
      .get();

    return ErrorLog.reconstruct({
      id: result.id,
      level: LogLevel.create(result.level),
      message: result.message,
      stack: result.stack ?? undefined,
      context: result.context ?? undefined,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    });
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(errorLogs).where(eq(errorLogs.id, id));
  }

  async deleteAll(): Promise<void> {
    await this.db.delete(errorLogs);
  }
}
