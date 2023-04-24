import { ValueObjectInterface } from "../../../../common/interfaces/value-object.interface";

export class RemoteFileUri implements ValueObjectInterface {
  #value: string;

  constructor(value: string) {
    this.#value = value;
  }

  get value(): string {
    return this.#value;
  }

  toJSON(): string {
    return this.#value;
  }

  toString(): string {
    return JSON.stringify(this.toJSON());
  }

  equals(other: RemoteFileUri): boolean {
    return this.#value === other.value;
  }
}
