import { ValueObjectInterface } from "../../../../common/interfaces/value-object.interface";

export class Sha1 implements ValueObjectInterface {
  #value: Buffer;

  constructor(value: Buffer) {
    this.#value = value;
  }

  get value(): Buffer {
    return this.#value;
  }

  toJSON(): string {
    return this.#value.toString("hex");
  }

  toString(): string {
    return JSON.stringify(this.toJSON());
  }

  equals(other: Sha1): boolean {
    return this.#value.equals(other.value);
  }
}
