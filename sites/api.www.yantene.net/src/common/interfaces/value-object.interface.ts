export type ValueObjectInterface = {
  /**
   * Returns a string representation of the value object.
   *
   * @returns String representation of the value object
   */
  toString(): string;

  /**
   * Compares the value object with another value object.
   *
   * @param other - Value object to compare
   * @returns True if the value object is equal to the other value object
   */
  equals(other: ValueObjectInterface): boolean;
};
