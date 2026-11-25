import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { INotificationQuotaCommandRepository } from "~/backend/domain/notification";
import { notificationQuotas } from "~/backend/infra/d1/schema";

/**
 * 通知の枠を D1 で数える。
 *
 * 判定と加算を upsert 1 手に収める。`sent < limit` を満たす行だけが更新され、
 * 更新された (または作られた) ときだけ行が返る。読んでから書く形にすると、同時に
 * 届いた要求がそろって上限の手前を読み、そろって送ってしまう。
 */
export class D1NotificationQuotaCommandRepository implements INotificationQuotaCommandRepository {
  private readonly db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  async tryTake(params: {
    readonly channel: string;
    readonly day: string;
    readonly limit: number;
  }): Promise<boolean> {
    // 上限 0 は行を作る前に断る。insert は条件を持てないので、作った時点で 1 通ぶん取れてしまう。
    if (params.limit <= 0) return false;

    const taken = await this.db
      .insert(notificationQuotas)
      .values({ channel: params.channel, day: params.day, sent: 1 })
      .onConflictDoUpdate({
        target: [notificationQuotas.channel, notificationQuotas.day],
        set: { sent: sql`${notificationQuotas.sent} + 1` },
        setWhere: sql`${notificationQuotas.sent} < ${params.limit}`,
      })
      .returning({ sent: notificationQuotas.sent });

    return taken.length > 0;
  }
}
