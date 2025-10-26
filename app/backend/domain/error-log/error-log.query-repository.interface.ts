import type { Temporal } from "@js-temporal/polyfill";
import type { IPersisted } from "../persisted.interface";
import type { ErrorLog } from "./error-log.entity";

export interface IErrorLogQueryRepository {
  findById(id: string): Promise<ErrorLog<IPersisted> | undefined>;

  findAll(options?: {
    limit?: number;
    offset?: number;
  }): Promise<ErrorLog<IPersisted>[]>;

  findByLevel(
    level: string,
    options?: {
      limit?: number;
      offset?: number;
    },
  ): Promise<ErrorLog<IPersisted>[]>;

  findByCreatedAtRange(
    from: Temporal.Instant,
    to: Temporal.Instant,
    options?: {
      limit?: number;
      offset?: number;
    },
  ): Promise<ErrorLog<IPersisted>[]>;

  count(): Promise<number>;
}
