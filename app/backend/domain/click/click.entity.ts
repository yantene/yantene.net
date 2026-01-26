import type { IEntity } from "../entity.interface";
import type { IPersisted } from "../persisted.interface";
import type { IUnpersisted } from "../unpersisted.interface";
import type { Temporal } from "@js-temporal/polyfill";

export class Click<P extends IPersisted | IUnpersisted> implements IEntity<
  Click<P>
> {
  private constructor(
    readonly id: P["id"],
    readonly timestamp: number,
    readonly createdAt: P["createdAt"],
    readonly updatedAt: P["updatedAt"],
  ) {}

  static create(params: { timestamp: number }): Click<IUnpersisted> {
    return new Click(undefined, params.timestamp, undefined, undefined);
  }

  static reconstruct(params: {
    id: string;
    timestamp: number;
    createdAt: Temporal.Instant;
    updatedAt: Temporal.Instant;
  }): Click<IPersisted> {
    return new Click(
      params.id,
      params.timestamp,
      params.createdAt,
      params.updatedAt,
    );
  }

  equals(other: Click<P>): boolean {
    if (this.id == null || other.id == null) {
      return this === other;
    }
    return this.id === other.id;
  }

  toJSON(): {
    id: P["id"];
    timestamp: number;
    createdAt: string | undefined;
    updatedAt: string | undefined;
  } {
    return {
      id: this.id,
      timestamp: this.timestamp,
      createdAt: this.createdAt?.toString(),
      updatedAt: this.updatedAt?.toString(),
    };
  }
}
