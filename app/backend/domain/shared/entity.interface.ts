export interface IEntity<T> {
  equals(other: T): boolean;
}
