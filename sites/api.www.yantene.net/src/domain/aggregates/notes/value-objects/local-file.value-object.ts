import { ValueObjectInterface } from "../../../../common/interfaces/value-object.interface";
import { Sha1 } from "./sha1.value-object";

export class LocalFile implements ValueObjectInterface {
  #path: string;

  #sha1: Sha1;

  constructor(path: string, sha1: Sha1) {
    this.#path = path.normalize(path);

    this.#sha1 = sha1;
  }

  /**
   * Build a local file.
   *
   * @param path - Path to the file
   * @returns A local file
   */
  async build(path: string): Promise<LocalFile> {
    const sha1 = await Sha1.calculateFromFile(path);

    return new LocalFile(path, sha1);
  }

  get path(): string {
    return this.#path;
  }

  get sha1(): Sha1 {
    return this.#sha1;
  }

  toJSON(): string {
    return this.#path;
  }

  toString(): string {
    return JSON.stringify(this.toJSON());
  }

  equals(other: LocalFile): boolean {
    return this.#path === other.#path;
  }
}
