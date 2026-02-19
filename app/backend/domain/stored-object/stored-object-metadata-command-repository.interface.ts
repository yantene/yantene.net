import type { IPersisted } from "../persisted.interface";
import type { ObjectKey } from "../shared/object-key.vo";
import type { IUnpersisted } from "../unpersisted.interface";
import type { StoredObjectMetadata } from "./stored-object-metadata.entity";

export interface IStoredObjectMetadataCommandRepository {
  upsert(
    metadata: StoredObjectMetadata<IUnpersisted>,
    options?: { preserveDownloadCount?: boolean },
  ): Promise<StoredObjectMetadata<IPersisted>>;
  deleteByObjectKey(objectKey: ObjectKey): Promise<void>;
  incrementDownloadCount(objectKey: ObjectKey): Promise<void>;
}
