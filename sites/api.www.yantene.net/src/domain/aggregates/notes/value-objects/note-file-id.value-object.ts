import { ValueObjectInterface } from "../../../../common/interfaces/value-object.interface";

export class NoteFileId implements ValueObjectInterface {
  #value: bigint;

  constructor(value: bigint) {
    if (!Number.isInteger(value)) {
      throw new TypeError("NoteFileId must be an integer.");
    }

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

  equals(other: NoteFileId): boolean {
    return this.#value === other.value;
  }
}
