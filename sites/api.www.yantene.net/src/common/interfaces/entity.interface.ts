import { ValueObjectInterface } from "./value-object.interface";

export type PersistentEntityInterface = EntityInterface & {
  id: ValueObjectInterface;
};

export type TransientEntityInterface = EntityInterface & {
  id: undefined;
};

export interface EntityInterface {
  /**
   * Returns the ID of the entity.
   */
  get id(): ValueObjectInterface | undefined;

  /**
   * Type guard for persistent entity.
   */
  isPersistent(): this is PersistentEntityInterface;

  /**
   * Type guard for transient entity.
   */
  isTransient(): this is TransientEntityInterface;

  /**
   * Asserts that the entity is persistent.
   */
  assertPersistent(): asserts this is PersistentEntityInterface;

  /**
   * Asserts that the entity is transient.
   */
  assertTransient(): asserts this is TransientEntityInterface;

  /**
   * Returns a string representation of the entity.
   *
   * @returns String representation of the entity
   */
  toString(): string;

  /**
   * Compares the entity with another entity.
   *
   * @param other - Entity to compare
   * @returns True if the entity is equal to the other entity
   */
  equals(other: PersistentEntityInterface): boolean;
}
