import { ValueObjectInterface } from "../../../../common/interfaces/value-object.interface";

export class RemoteFileUri implements ValueObjectInterface {
  constructor(readonly value: string) {}

  toJSON(): string {
    return this.value;
  }

  toString(): string {
    return JSON.stringify(this.toJSON());
  }

  equals(other: RemoteFileUri): boolean {
    return this.value === other.value;
  }
}
