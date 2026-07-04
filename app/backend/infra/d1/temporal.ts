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
