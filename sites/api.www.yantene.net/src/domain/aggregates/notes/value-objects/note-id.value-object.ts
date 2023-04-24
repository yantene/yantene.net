import { ValueObjectInterface } from "../../../../common/interfaces/value-object.interface";

export class NoteId implements ValueObjectInterface {
  #value: bigint;

  constructor(value: bigint) {
    this.#value = value;
  }

  get value(): bigint {
    return this.#value;
  }

  toJSON(): string {
    return this.#value.toString();
  }

  toString(): string {
    return JSON.stringify(this.toJSON());
  }

  equals(other: NoteId): boolean {
    return this.#value === other.value;
  }
}
