export class NoteFileUri {
  #value: string;

  constructor(value: string) {
    this.#value = value;
  }

  get value(): string {
    return this.#value;
  }
}
