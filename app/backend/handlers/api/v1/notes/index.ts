import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { NoteCommandRepository } from "../../../../infra/d1/note/note.command-repository";
import { NoteQueryRepository } from "../../../../infra/d1/note/note.query-repository";
import { StoredObjectStorage } from "../../../../infra/r2/stored-object.storage";
import { NotesRefreshService } from "../../../../services/notes-refresh.service";
import type { NotesRefreshResponse } from "~/lib/types/notes";
import type { ProblemDetails } from "~/lib/types/problem-details";

export const notesApp = new Hono<{ Bindings: Env }>().post(
  "/refresh",
  async (c): Promise<Response> => {
    try {
      const db = drizzle(c.env.D1);
      const queryRepository = new NoteQueryRepository(db);
      const commandRepository = new NoteCommandRepository(db, queryRepository);
      const storage = new StoredObjectStorage(c.env.R2);
      const service = new NotesRefreshService(
        storage,
        queryRepository,
        commandRepository,
      );

      const result = await service.execute();

      const response: NotesRefreshResponse = {
        added: result.added,
        updated: result.updated,
        deleted: result.deleted,
      };

      return c.json(response);
    } catch (error) {
      console.error("Notes refresh error:", error);

      const detail =
        error instanceof Error ? error.message : "Failed to refresh notes";

      const problemDetails: ProblemDetails = {
        type: "about:blank",
        title: "Internal Server Error",
        status: 500,
        detail,
      };

      return Response.json(problemDetails, {
        status: 500,
        headers: { "Content-Type": "application/problem+json" },
      });
    }
  },
);
