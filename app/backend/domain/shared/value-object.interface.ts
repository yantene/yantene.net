export interface IValueObject<T> {
  equals(other: T): boolean;
  toJSON(): unknown;
}
