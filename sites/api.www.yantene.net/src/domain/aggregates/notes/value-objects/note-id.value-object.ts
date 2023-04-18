import { ValueObjectInterface } from "../../../../common/interfaces/value-object.interface";

export class NoteId implements ValueObjectInterface {
  #value: number;

  constructor(value: number) {
    if (!Number.isInteger(value)) {
      throw new TypeError("NoteId must be an integer.");
    }

    this.#value = value;
  }

  get value(): number {
    return this.#value;
  }

  toString(): string {
    return this.#value.toString();
  }

  equals(other: NoteId): boolean {
    return this.#value === other.value;
  }
}
