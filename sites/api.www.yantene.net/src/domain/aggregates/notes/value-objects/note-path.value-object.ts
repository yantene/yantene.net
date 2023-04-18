import { ValueObjectInterface } from "../../../../common/interfaces/value-object.interface";

export class NotePath implements ValueObjectInterface {
  #value: string;

  constructor(value: string) {
    this.#value = value;
  }

  get value(): string {
    return this.#value;
  }

  toString(): string {
    return this.#value;
  }

  equals(other: NotePath): boolean {
    return this.#value === other.value;
  }
}
