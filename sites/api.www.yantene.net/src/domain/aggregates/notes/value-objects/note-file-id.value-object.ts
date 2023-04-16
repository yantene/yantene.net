export class NoteFileId {
  #value: number;

  constructor(value: number) {
    if (!Number.isInteger(value)) {
      throw new TypeError("NoteFileId must be an integer.");
    }

    this.#value = value;
  }

  get value(): number {
    return this.#value;
  }
}
