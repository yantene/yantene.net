import { createHash } from "crypto";
import { createReadStream } from "fs";
import { ValueObjectInterface } from "../../../../common/interfaces/value-object.interface";

export class Sha1 implements ValueObjectInterface {
  #value: Buffer;

  constructor(value: Buffer) {
    this.#value = value;
  }

  /**
   * Build a SHA-1 hash from a hex string.
   *
   * @param hex - Hex string
   * @returns SHA-1 hash
   */
  static buildFromHex(hex: string): Sha1 {
    return new Sha1(Buffer.from(hex, "hex"));
  }

  get value(): Buffer {
    return this.#value;
  }

  /**
   * Calculate SHA-1 hash of the file.
   *
   * @param filePath - Path to the file
   * @returns SHA-1 hash of the file
   */
  static async calculateFromFile(filePath: string): Promise<Sha1> {
    const hash = createHash("sha1");
    const stream = createReadStream(filePath);

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

  toJSON(): string {
    return this.#value.toString("hex");
  }

  toString(): string {
    return JSON.stringify(this.toJSON());
  }

  equals(other: Sha1): boolean {
    return this.#value.equals(other.value);
  }
}
