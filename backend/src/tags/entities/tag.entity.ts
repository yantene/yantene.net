import { Temporal } from "@js-temporal/polyfill";
import { Name } from "../value-objects/name.value-object";

export class Tag {
  #name: Name;

  #createdAt: Temporal.Instant;

  #modifiedAt: Temporal.Instant;

  constructor(
    name: Name,
    createdAt: Temporal.Instant,
    modifiedAt: Temporal.Instant,
  ) {
    this.#name = name;

    this.#createdAt = createdAt;
    this.#modifiedAt = modifiedAt;
  }

  get name(): Name {
    return this.#name;
  }

  get createdAt(): Temporal.Instant {
    return this.#createdAt;
  }

  get updatedAt(): Temporal.Instant {
    return this.#modifiedAt;
  }
}
