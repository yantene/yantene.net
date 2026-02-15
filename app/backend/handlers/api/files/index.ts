import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import type { ErrorResponse, FileListResponse } from "~/lib/types/object-storage";
import { ObjectKey } from "../../../domain/stored-object/object-key.vo";
import { StoredObjectMetadataRepository } from "../../../infra/d1/stored-object/stored-object-metadata.repository";
import { StoredObjectStorage } from "../../../infra/r2/stored-object.storage";

export const filesApp = new Hono<{ Bindings: Env }>()
  .get("/", async (c): Promise<Response> => {
    try {
      const db = drizzle(c.env.D1);
      const repository = new StoredObjectMetadataRepository(db);
      const allMetadata = await repository.findAll();

      const response: FileListResponse = {
        files: allMetadata.map((metadata) => ({
          key: metadata.objectKey.value,
          size: metadata.size,
          contentType: metadata.contentType.value,
          downloadCount: metadata.downloadCount,
        })),
      };

      return c.json(response);
    } catch (error) {
      console.error("Files list fetch error:", error);
      const errorResponse: ErrorResponse = {
        error: "Failed to fetch files",
      };
      return c.json(errorResponse, 500);
    }
  })
  .get("/:key{.+}", async (c): Promise<Response> => {
    try {
      const key = c.req.param("key");
      const objectKey = ObjectKey.create(key);

      const db = drizzle(c.env.D1);
      const repository = new StoredObjectMetadataRepository(db);
      const metadata = await repository.findByObjectKey(objectKey);

      if (!metadata) {
        const errorResponse: ErrorResponse = {
          error: `File not found: ${key}`,
        };
        return c.json(errorResponse, 404);
      }

      const storage = new StoredObjectStorage(c.env.R2);
      const content = await storage.get(objectKey);

      if (!content) {
        const errorResponse: ErrorResponse = {
          error: "Failed to fetch file content",
        };
        return c.json(errorResponse, 500);
      }

      await repository.incrementDownloadCount(objectKey);

      const filename = key.split("/").pop() ?? key;

      return new Response(content.body, {
        headers: {
          "Content-Type": content.contentType.value,
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    } catch (error) {
      console.error("File download error:", error);
      const errorResponse: ErrorResponse = {
        error: "Failed to download file",
      };
      return c.json(errorResponse, 500);
    }
  });
