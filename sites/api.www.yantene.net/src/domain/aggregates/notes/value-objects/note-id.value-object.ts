export class NoteId {
  #value: number;

  constructor(value: number) {
    if (!Number.isInteger(value)) {
      throw new TypeError("NoteId must be an integer.");
    }

    this.#value = value;
  }

  get value(): number {
    return this.#value;
  }
}
