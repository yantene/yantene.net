import type { Temporal } from "@js-temporal/polyfill";
import { and, count, eq, gte, lte } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { ErrorLog } from "../../../domain/error-log/error-log.entity";
import type { IErrorLogQueryRepository } from "../../../domain/error-log/error-log.query-repository.interface";
import { LogLevel } from "../../../domain/error-log/log-level.vo";
import type { IPersisted } from "../../../domain/persisted.interface";
import { errorLogs } from "../schema";

export class ErrorLogQueryRepository implements IErrorLogQueryRepository {
  constructor(private readonly db: DrizzleD1Database) {}

  async findById(id: string): Promise<ErrorLog<IPersisted> | undefined> {
    const result = await this.db
      .select()
      .from(errorLogs)
      .where(eq(errorLogs.id, id))
      .get();

    if (!result) {
      return undefined;
    }

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

  async findAll(options?: {
    limit?: number;
    offset?: number;
  }): Promise<ErrorLog<IPersisted>[]> {
    const query = this.db.select().from(errorLogs);

    if (options?.limit) {
      query.limit(options.limit);
    }

    if (options?.offset) {
      query.offset(options.offset);
    }

    const results = await query.all();

    return results.map((result) =>
      ErrorLog.reconstruct({
        id: result.id,
        level: LogLevel.create(result.level),
        message: result.message,
        stack: result.stack ?? undefined,
        context: result.context ?? undefined,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      }),
    );
  }

  async findByLevel(
    level: string,
    options?: {
      limit?: number;
      offset?: number;
    },
  ): Promise<ErrorLog<IPersisted>[]> {
    const query = this.db
      .select()
      .from(errorLogs)
      .where(eq(errorLogs.level, level));

    if (options?.limit) {
      query.limit(options.limit);
    }

    if (options?.offset) {
      query.offset(options.offset);
    }

    const results = await query.all();

    return results.map((result) =>
      ErrorLog.reconstruct({
        id: result.id,
        level: LogLevel.create(result.level),
        message: result.message,
        stack: result.stack ?? undefined,
        context: result.context ?? undefined,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      }),
    );
  }

  async findByCreatedAtRange(
    from: Temporal.Instant,
    to: Temporal.Instant,
    options?: {
      limit?: number;
      offset?: number;
    },
  ): Promise<ErrorLog<IPersisted>[]> {
    const query = this.db
      .select()
      .from(errorLogs)
      .where(and(gte(errorLogs.createdAt, from), lte(errorLogs.createdAt, to)));

    if (options?.limit) {
      query.limit(options.limit);
    }

    if (options?.offset) {
      query.offset(options.offset);
    }

    const results = await query.all();

    return results.map((result) =>
      ErrorLog.reconstruct({
        id: result.id,
        level: LogLevel.create(result.level),
        message: result.message,
        stack: result.stack ?? undefined,
        context: result.context ?? undefined,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      }),
    );
  }

  async count(): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(errorLogs)
      .get();

    return result?.count ?? 0;
  }
}
