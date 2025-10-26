import type { Temporal } from "@js-temporal/polyfill";
import type { IEntity } from "../entity.interface";
import type { IPersisted } from "../persisted.interface";
import type { IUnpersisted } from "../unpersisted.interface";
import type { LogLevel } from "./log-level.vo";

export class ErrorLog<P extends IPersisted | IUnpersisted>
  implements IEntity<ErrorLog<P>>
{
  private constructor(
    readonly id: P["id"],
    readonly level: LogLevel,
    readonly message: string,
    readonly stack: string | undefined,
    readonly context: string | undefined,
    readonly createdAt: P["createdAt"],
    readonly updatedAt: P["updatedAt"],
  ) {}

  static create(params: {
    level: LogLevel;
    message: string;
    stack?: string | undefined;
    context?: string | undefined;
  }): ErrorLog<IUnpersisted> {
    return new ErrorLog(
      undefined,
      params.level,
      params.message,
      params.stack ?? undefined,
      params.context ?? undefined,
      undefined,
      undefined,
    );
  }

  static reconstruct(params: {
    id: string;
    level: LogLevel;
    message: string;
    stack: string | undefined;
    context: string | undefined;
    createdAt: Temporal.Instant;
    updatedAt: Temporal.Instant;
  }): ErrorLog<IPersisted> {
    return new ErrorLog(
      params.id,
      params.level,
      params.message,
      params.stack,
      params.context,
      params.createdAt,
      params.updatedAt,
    );
  }

  equals(other: ErrorLog<P>): boolean {
    return this.id === other.id;
  }

  toJSON() {
    return {
      id: this.id,
      level: this.level.toJSON(),
      message: this.message,
      stack: this.stack,
      context: this.context,
      createdAt: this.createdAt?.toString(),
      updatedAt: this.updatedAt?.toString(),
    };
  }
}
