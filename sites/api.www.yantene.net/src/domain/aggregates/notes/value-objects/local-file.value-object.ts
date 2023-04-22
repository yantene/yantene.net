import { createHash } from "crypto";
import { createReadStream } from "fs";
import { ValueObjectInterface } from "../../../../common/interfaces/value-object.interface";
import { Sha1 } from "./sha1.value-object";

export class LocalFile implements ValueObjectInterface {
  #path: string;

  constructor(path: string) {
    this.#path = path.normalize(path);
  }

  /**
   * Calculate SHA-1 hash of the file.
   *
   * @returns SHA-1 hash of the file
   */
  async calculateSha1(): Promise<Sha1> {
    const hash = createHash("sha1");
    const stream = createReadStream(this.#path);

    return new Promise<Sha1>((resolve, reject) => {
      stream.on("error", (error) => {
        reject(error);
      });

      stream.on("data", (chunk) => {
        hash.update(chunk);
      });

      stream.on("end", () => {
        stream.close();

        resolve(new Sha1(hash.digest()));
      });
    });
  }

  get path(): string {
    return this.#path;
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
