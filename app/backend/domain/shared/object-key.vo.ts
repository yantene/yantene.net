import type { IValueObject } from "./value-object.interface";

export class ObjectKey implements IValueObject<ObjectKey> {
  private constructor(readonly value: string) {}

  static create(value: string): ObjectKey {
    if (!ObjectKey.isValid(value)) {
      throw new Error(`Invalid object key: ${value}`);
    }
    return new ObjectKey(value);
  }

  equals(other: ObjectKey): boolean {
    return this.value === other.value;
  }

  toJSON(): string {
    return this.value;
  }

  private static isValid(value: string): boolean {
    return value.length > 0;
  }
}
