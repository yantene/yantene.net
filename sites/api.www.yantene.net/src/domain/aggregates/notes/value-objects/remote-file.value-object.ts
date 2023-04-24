import { Temporal } from "@js-temporal/polyfill";
import { ValueObjectInterface } from "../../../../common/interfaces/value-object.interface";
import { RemoteFileUri } from "./remote-file-uri.value-object";
import { Sha1 } from "./sha1.value-object";

export class RemoteFile implements ValueObjectInterface {
  #uri: RemoteFileUri;

  #sha1: Sha1;

  #uploadedAt: Temporal.Instant;

  constructor(uri: RemoteFileUri, sha1: Sha1, uploadedAt: Temporal.Instant) {
    this.#uri = uri;
    this.#sha1 = sha1;
    this.#uploadedAt = uploadedAt;
  }

  get uri(): RemoteFileUri {
    return this.#uri;
  }

  get sha1(): Sha1 {
    return this.#sha1;
  }

  get uploadedAt(): Temporal.Instant {
    return this.#uploadedAt;
  }

  toJSON(): {
    uri: ReturnType<InstanceType<typeof RemoteFileUri>["toJSON"]>;
    sha1: ReturnType<InstanceType<typeof Sha1>["toJSON"]>;
    uploadedAt: ReturnType<InstanceType<typeof Temporal.Instant>["toJSON"]>;
  } {
    return {
      uri: this.#uri.toJSON(),
      sha1: this.#sha1.toJSON(),
      uploadedAt: this.#uploadedAt.toJSON(),
    };
  }

  toString(): string {
    return JSON.stringify(this.toJSON());
  }

  equals(other: RemoteFile): boolean {
    return (
      this.#uri.equals(other.#uri) &&
      this.#sha1.equals(other.#sha1) &&
      this.#uploadedAt.equals(other.#uploadedAt)
    );
  }
}
