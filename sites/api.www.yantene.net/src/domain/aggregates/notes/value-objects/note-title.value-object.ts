import { ValueObjectInterface } from "../../../../common/interfaces/value-object.interface";

export class NoteTitle implements ValueObjectInterface {
  constructor(readonly value: string) {}

  toJSON(): string {
    return this.value;
  }

  toString(): string {
    return JSON.stringify(this.toJSON());
  }

  equals(other: NoteTitle): boolean {
    return this.value === other.value;
  }
}
