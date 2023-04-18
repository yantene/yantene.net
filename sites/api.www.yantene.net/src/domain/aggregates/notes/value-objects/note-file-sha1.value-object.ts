import { ValueObjectInterface } from "../../../../common/interfaces/value-object.interface";

export class NoteFileSha1 implements ValueObjectInterface {
  #value: string;

  constructor(value: string) {
    this.#value = value;
  }

  get value(): string {
    return this.#value;
  }

  toString(): string {
    return this.#value.toString();
  }

  equals(other: NoteFileSha1): boolean {
    return this.#value === other.value;
  }
}
