import { Temporal } from "@js-temporal/polyfill";
import { customType } from "drizzle-orm/sqlite-core";

export const instant = customType<{
  data: Temporal.Instant;
  driverData: number;
}>({
  dataType(): string {
    return "real";
  },
  toDriver(value: Temporal.Instant): number {
    return value.epochMilliseconds / 1000;
  },
  fromDriver(value: number): Temporal.Instant {
    const milliseconds = Math.floor(value * 1000);
    return Temporal.Instant.fromEpochMilliseconds(milliseconds);
  },
});
