import { Temporal } from "@js-temporal/polyfill";
import { customType } from "drizzle-orm/sqlite-core";

export const plainDate = customType<{
  data: Temporal.PlainDate;
  driverData: string;
}>({
  dataType(): string {
    return "text";
  },
  toDriver(value: Temporal.PlainDate): string {
    return value.toString();
  },
  fromDriver(value: string): Temporal.PlainDate {
    return Temporal.PlainDate.from(value);
  },
});

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
