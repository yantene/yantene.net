import type { IPersisted } from "../persisted.interface";
import type { IUnpersisted } from "../unpersisted.interface";
import type { ObjectKey } from "./object-key.vo";
import type { StoredObjectMetadata } from "./stored-object-metadata.entity";

export interface IStoredObjectMetadataCommandRepository {
  upsert(
    metadata: StoredObjectMetadata<IUnpersisted>,
    preserveDownloadCount?: boolean,
  ): Promise<StoredObjectMetadata<IPersisted>>;
  deleteByObjectKey(objectKey: ObjectKey): Promise<void>;
  incrementDownloadCount(objectKey: ObjectKey): Promise<void>;
}
