import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { ListNotesUseCase } from "../../../../domain/note/usecases/list-notes.usecase";
import {
  PaginationParams,
  PaginationValidationError,
} from "../../../../domain/shared/pagination/pagination-params.vo";
import { NoteCommandRepository } from "../../../../infra/d1/note/note.command-repository";
import { NoteQueryRepository } from "../../../../infra/d1/note/note.query-repository";
import { MarkdownStorage } from "../../../../infra/r2/note/markdown.storage";
import { NotesRefreshService } from "../../../../services/notes-refresh.service";
import type { Note } from "../../../../domain/note/note.entity";
import type { IPersisted } from "../../../../domain/shared/persisted.interface";
import type { NotesRefreshResponse } from "~/lib/types/notes";
import type { ProblemDetails } from "~/lib/types/problem-details";

type NoteListItem = {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly imageUrl: string;
  readonly publishedOn: string;
  readonly lastModifiedOn: string;
};

const toNoteListItem = (note: Note<IPersisted>): NoteListItem => ({
  id: note.id,
  title: note.title.toJSON(),
  slug: note.slug.toJSON(),
  imageUrl: note.imageUrl.toJSON(),
  publishedOn: note.publishedOn.toString(),
  lastModifiedOn: note.lastModifiedOn.toString(),
});

const toProblemDetailMessage = (error: PaginationValidationError): string => {
  const fieldName = error.field === "perPage" ? "per-page" : error.field;
  return `${fieldName} ${error.reason}`;
};

export const notesApp = new Hono<{ Bindings: Env }>()
  .get("/", async (c): Promise<Response> => {
    try {
      const page = c.req.query("page");
      const perPage = c.req.query("per-page");

      const params = PaginationParams.create({ page, perPage });

      const db = drizzle(c.env.D1);
      const queryRepository = new NoteQueryRepository(db);
      const useCase = new ListNotesUseCase(queryRepository);

      const result = await useCase.execute(params);

      const response = {
        notes: result.items.map((note) => toNoteListItem(note)),
        pagination: result.pagination,
      };

      return c.json(response);
    } catch (error) {
      if (error instanceof PaginationValidationError) {
        const problemDetails: ProblemDetails = {
          type: "about:blank",
          title: "Bad Request",
          status: 400,
          detail: toProblemDetailMessage(error),
        };

        return Response.json(problemDetails, {
          status: 400,
          headers: { "Content-Type": "application/problem+json" },
        });
      }

      console.error("Notes list error:", error);

      const detail =
        error instanceof Error ? error.message : "Failed to list notes";

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
  })
  .post("/refresh", async (c): Promise<Response> => {
    try {
      const db = drizzle(c.env.D1);
      const queryRepository = new NoteQueryRepository(db);
      const commandRepository = new NoteCommandRepository(db, queryRepository);
      const storage = new MarkdownStorage(c.env.R2);
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
  });
