import { count as drizzleCount } from "drizzle-orm";
import { Click } from "../../../domain/click/click.entity";
import { clicks } from "../schema";
import type { IClickCommandRepository } from "../../../domain/click/click.command-repository.interface";
import type { IPersisted } from "../../../domain/persisted.interface";
import type { IUnpersisted } from "../../../domain/unpersisted.interface";
import type { DrizzleD1Database } from "drizzle-orm/d1";

export class ClickCommandRepository implements IClickCommandRepository {
  constructor(private readonly db: DrizzleD1Database) {}

  async save(click: Click<IUnpersisted>): Promise<Click<IPersisted>> {
    const id = crypto.randomUUID();
    const data = {
      id,
      timestamp: click.timestamp,
    };

    const result = await this.db.insert(clicks).values(data).returning().get();

    return Click.reconstruct({
      id: result.id,
      timestamp: result.timestamp,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    });
  }

  async count(): Promise<number> {
    const result = await this.db
      .select({ count: drizzleCount() })
      .from(clicks)
      .get();

    return result?.count ?? 0;
  }
}
