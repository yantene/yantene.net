import { Temporal } from "@js-temporal/polyfill";

/**
 * Convert a Temporal.Instant to a Unix timestamp (seconds) for D1 integer storage.
 */
export function instantToUnix(instant: Temporal.Instant): number {
  return Math.floor(instant.epochMilliseconds / 1000);
}

/**
 * Convert a Unix timestamp (seconds) from D1 to a Temporal.Instant.
 */
export function unixToInstant(unix: number): Temporal.Instant {
  return Temporal.Instant.fromEpochMilliseconds(unix * 1000);
}

/**
 * Convert a Temporal.PlainDate to an ISO date string ("YYYY-MM-DD") for D1 text
 * storage. ISO date strings sort lexicographically in the same order as the dates,
 * so they can be ordered directly in SQL.
 */
export function plainDateToIso(date: Temporal.PlainDate): string {
  return date.toString();
}

/**
 * Convert an ISO date string ("YYYY-MM-DD") from D1 to a Temporal.PlainDate.
 */
export function isoToPlainDate(iso: string): Temporal.PlainDate {
  return Temporal.PlainDate.from(iso);
}
