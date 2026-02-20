import type { StoredObjectMetadata } from "./stored-object-metadata";
import type { ObjectKey } from "../../domain/shared/object-key.vo";

export interface IStoredObjectMetadataQueryRepository {
  findAll(): Promise<readonly StoredObjectMetadata[]>;
  findByObjectKey(
    objectKey: ObjectKey,
  ): Promise<StoredObjectMetadata | undefined>;
}
