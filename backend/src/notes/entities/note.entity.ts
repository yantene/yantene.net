import { Temporal } from "@js-temporal/polyfill";
import { Tag } from "../../tags/entities/tag.entity";
import { User } from "../../users/entities/user.entity";
import { Body } from "../value-objects/body.value-object";
import { Title } from "../value-objects/title.value-object";

export class Note {
  #title: Title;

  #author: User;

  #tags: Tag[];

  #createdAt: Temporal.Instant;

  #modifiedAt: Temporal.Instant;

  #body: Body;

  constructor(
    title: Title,
    author: User,
    createdAt: Temporal.Instant,
    modifiedAt: Temporal.Instant,
    body: Body,
  ) {
    this.#title = title;

    this.#author = author;

    this.#createdAt = createdAt;
    this.#modifiedAt = modifiedAt;

    this.#body = body;
  }

  get title(): Title {
    return this.#title;
  }

  get author(): User {
    return this.#author;
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
