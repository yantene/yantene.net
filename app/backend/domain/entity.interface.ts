export interface IEntity<T extends IEntity<T>> {
  equals(other: T): boolean;

  toJSON(): unknown;
}
