import * as nodePath from "path";
import { ValueObjectInterface } from "../../../../common/interfaces/value-object.interface";
import { Sha1 } from "./sha1.value-object";

export class LocalFile implements ValueObjectInterface {
  readonly path: string;

  constructor(path: string, readonly sha1: Sha1) {
    this.path = nodePath.normalize(path);
  }

  /**
   * Build a local file.
   *
   * @param path - Path to the file
   * @returns A local file
   */
  static async build(path: string): Promise<LocalFile> {
    const sha1 = await Sha1.calculateFromFile(path);

    return new LocalFile(path, sha1);
  }

  toJSON(): string {
    return this.path;
  }

  toString(): string {
    return JSON.stringify(this.toJSON());
  }

  equals(other: LocalFile): boolean {
    return this.path === other.path;
  }
}
