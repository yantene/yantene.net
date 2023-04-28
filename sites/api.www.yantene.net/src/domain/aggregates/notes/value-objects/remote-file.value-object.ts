import { Temporal } from "@js-temporal/polyfill";
import { ValueObjectInterface } from "../../../../common/interfaces/value-object.interface";
import { RemoteFileUri } from "./remote-file-uri.value-object";
import { Sha1 } from "./sha1.value-object";

export class RemoteFile implements ValueObjectInterface {
  constructor(
    readonly uri: RemoteFileUri,
    readonly sha1: Sha1,
    readonly uploadedAt: Temporal.Instant,
  ) {}

  toJSON(): {
    uri: ReturnType<InstanceType<typeof RemoteFileUri>["toJSON"]>;
    sha1: ReturnType<InstanceType<typeof Sha1>["toJSON"]>;
    uploadedAt: ReturnType<InstanceType<typeof Temporal.Instant>["toJSON"]>;
  } {
    return {
      uri: this.uri.toJSON(),
      sha1: this.sha1.toJSON(),
      uploadedAt: this.uploadedAt.toJSON(),
    };
  }

  toString(): string {
    return JSON.stringify(this.toJSON());
  }

  equals(other: RemoteFile): boolean {
    return (
      this.uri.equals(other.uri) &&
      this.sha1.equals(other.sha1) &&
      this.uploadedAt.equals(other.uploadedAt)
    );
  }
}
