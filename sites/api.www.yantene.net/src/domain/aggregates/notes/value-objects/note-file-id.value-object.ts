import { ValueObjectInterface } from "../../../../common/interfaces/value-object.interface";

export class NoteFileId implements ValueObjectInterface {
  constructor(readonly value: bigint) {
    if (!Number.isInteger(value)) {
      throw new TypeError("NoteFileId must be an integer.");
    }
  }

  toJSON(): string {
    return this.value.toString();
  }

  toString(): string {
    return JSON.stringify(this.toJSON());
  }

  equals(other: NoteFileId): boolean {
    return this.value === other.value;
  }
}
