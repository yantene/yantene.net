import type { IValueObject } from "../value-object.interface";

export class NoteSlug implements IValueObject<NoteSlug> {
  private constructor(readonly value: string) {}

  static create(value: string): NoteSlug {
    if (!NoteSlug.isValid(value)) {
      throw new Error(`Invalid note slug: ${value}`);
    }
    return new NoteSlug(value);
  }

  equals(other: NoteSlug): boolean {
    return this.value === other.value;
  }

  toJSON(): string {
    return this.value;
  }

  private static isValid(value: string): boolean {
    if (value.length === 0) return false;
    if (value.startsWith("-") || value.endsWith("-")) return false;
    if (value.includes("--")) return false;
    return /^[a-z0-9-]+$/.test(value);
  }
}
