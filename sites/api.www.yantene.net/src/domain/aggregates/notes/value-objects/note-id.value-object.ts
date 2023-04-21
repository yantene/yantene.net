import { ValueObjectInterface } from "../../../../common/interfaces/value-object.interface";

export class NoteId implements ValueObjectInterface {
  #value: bigint;

  constructor(value: bigint) {
    this.#value = value;
  }

  get value(): bigint {
    return this.#value;
  }

  toString(): string {
    return this.#value.toString();
  }

  equals(other: NoteId): boolean {
    return this.#value === other.value;
  }
}
