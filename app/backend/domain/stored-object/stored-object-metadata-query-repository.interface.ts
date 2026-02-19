import type { IPersisted } from "../persisted.interface";
import type { StoredObjectMetadata } from "./stored-object-metadata.entity";
import type { ObjectKey } from "../shared/object-key.vo";

export interface IStoredObjectMetadataQueryRepository {
  findAll(): Promise<readonly StoredObjectMetadata<IPersisted>[]>;
  findByObjectKey(
    objectKey: ObjectKey,
  ): Promise<StoredObjectMetadata<IPersisted> | undefined>;
}
