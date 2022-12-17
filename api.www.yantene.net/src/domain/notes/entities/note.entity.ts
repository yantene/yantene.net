import { Temporal } from "@js-temporal/polyfill";
import { Tag } from "../../tags/entities/tag.entity";
import { Body } from "../value-objects/body.value-object";
import { Title } from "../value-objects/title.value-object";

export class Note {
  #title: Title;

  #tags: Tag[];

  #createdAt: Temporal.Instant;

  #modifiedAt: Temporal.Instant;

  #body: Body;

  constructor(
    title: Title,
    createdAt: Temporal.Instant,
    modifiedAt: Temporal.Instant,
    body: Body,
  ) {
    this.#title = title;

    this.#createdAt = createdAt;
    this.#modifiedAt = modifiedAt;

    this.#body = body;
  }

  get title(): Title {
    return this.#title;
  }

  get tags(): Tag[] {
    return this.#tags;
  }

  get createdAt(): Temporal.Instant {
    return this.#createdAt;
  }

  get modifiedAt(): Temporal.Instant {
    return this.#modifiedAt;
  }

  get body(): Body {
    return this.#body;
  }
}
