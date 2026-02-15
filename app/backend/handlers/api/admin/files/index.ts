import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import type { ErrorResponse, SyncResponse } from "~/lib/types/object-storage";
import { StoredObjectMetadataRepository } from "../../../../infra/d1/stored-object/stored-object-metadata.repository";
import { StoredObjectStorage } from "../../../../infra/r2/stored-object.storage";
import { SyncService } from "../../../../services/sync.service";

export const adminFilesApp = new Hono<{ Bindings: Env }>().post(
  "/sync",
  async (c): Promise<Response> => {
    try {
      const db = drizzle(c.env.D1);
      const repository = new StoredObjectMetadataRepository(db);
      const storage = new StoredObjectStorage(c.env.R2);
      const syncService = new SyncService(storage, repository);

      const result = await syncService.execute();

      const response: SyncResponse = {
        added: result.added,
        deleted: result.deleted,
        updated: result.updated,
      };

      return c.json(response);
    } catch (error) {
      console.error("Files sync error:", error);
      const errorResponse: ErrorResponse = {
        error: "Failed to sync files",
      };
      return c.json(errorResponse, 500);
    }
  },
);
