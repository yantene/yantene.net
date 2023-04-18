export type EntityInterface = {
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
  equals(other: EntityInterface): boolean;
};
