import { InvalidNoteTitleError } from "./errors";
import type { IValueObject } from "../shared/value-object.interface";

export class NoteTitle implements IValueObject<NoteTitle> {
  private constructor(readonly value: string) {}

  static create(value: string): NoteTitle {
    if (!NoteTitle.isValid(value)) {
      throw new InvalidNoteTitleError(value);
    }
    return new NoteTitle(value);
  }

  equals(other: NoteTitle): boolean {
    return this.value === other.value;
  }

  toJSON(): string {
    return this.value;
  }

  private static isValid(value: string): boolean {
    return value.length > 0;
  }
}
