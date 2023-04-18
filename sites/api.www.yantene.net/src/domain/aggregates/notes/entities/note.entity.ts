import { Temporal } from "@js-temporal/polyfill";
import { NoteTitle } from "../value-objects/note-title.value-object";
import { NoteId } from "../value-objects/note-id.value-object";
import { NotePath } from "../value-objects/note-path.value-object";
import { NoteBody } from "../value-objects/note-body.value-object";
import { EntityInterface } from "../../../../common/interfaces/entity.interface";

export class Note implements EntityInterface {
  #id?: NoteId;

  #title: NoteTitle;

  #path: NotePath;

  #createdAt: Temporal.Instant;

  #modifiedAt: Temporal.Instant;

  #body: NoteBody;

  constructor(
    id: NoteId | undefined,
    title: NoteTitle,
    path: NotePath,
    createdAt: Temporal.Instant,
    modifiedAt: Temporal.Instant,
    body: NoteBody,
  ) {
    this.#id = id;
    this.#title = title;
    this.#path = path;

    this.#createdAt = createdAt;
    this.#modifiedAt = modifiedAt;

    this.#body = body;
  }

  get id(): NoteId | undefined {
    return this.#id;
  }

  get title(): NoteTitle {
    return this.#title;
  }

  get path(): NotePath {
    return this.#path;
  }

  get createdAt(): Temporal.Instant {
    return this.#createdAt;
  }

  get modifiedAt(): Temporal.Instant {
    return this.#modifiedAt;
  }

  get body(): NoteBody {
    return this.#body;
  }

  toString(): string {
    return {
      id: this.#id,
      title: this.#title,
      path: this.#path,
      createdAt: this.#createdAt,
      modifiedAt: this.#modifiedAt,
      body: this.#body,
    }.toString();
  }

  equals(other: Note): boolean {
    if (!this.id || !other.id) return false;

    return this.id.equals(other.id);
  }
}