import type { IPersisted } from "../persisted.interface";
import type { ObjectKey } from "./object-key.vo";
import type { StoredObjectMetadata } from "./stored-object-metadata.entity";

export interface IStoredObjectMetadataQueryRepository {
  findAll(): Promise<readonly StoredObjectMetadata<IPersisted>[]>;
  findByObjectKey(
    objectKey: ObjectKey,
  ): Promise<StoredObjectMetadata<IPersisted> | undefined>;
}
