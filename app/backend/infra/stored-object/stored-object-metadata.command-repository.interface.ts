import type { StoredObjectMetadata } from "./stored-object-metadata";
import type { ObjectKey } from "../../domain/shared/object-key.vo";

export interface IStoredObjectMetadataCommandRepository {
  upsert(
    metadata: StoredObjectMetadata,
    options?: { preserveDownloadCount?: boolean },
  ): Promise<StoredObjectMetadata>;
  deleteByObjectKey(objectKey: ObjectKey): Promise<void>;
  incrementDownloadCount(objectKey: ObjectKey): Promise<void>;
}
