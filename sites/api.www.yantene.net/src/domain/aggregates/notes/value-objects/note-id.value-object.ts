import { ValueObjectInterface } from "../../../../common/interfaces/value-object.interface";

export class NoteId implements ValueObjectInterface {
  constructor(readonly value: bigint) {}

  toJSON(): string {
    return this.value.toString();
  }

  toString(): string {
    return JSON.stringify(this.toJSON());
  }

  equals(other: NoteId): boolean {
    return this.value === other.value;
  }
}
