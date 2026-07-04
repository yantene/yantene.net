import type { Temporal } from "@js-temporal/polyfill";

export interface IPersisted {
  id: string;
  createdAt: Temporal.Instant;
  updatedAt: Temporal.Instant;
}
