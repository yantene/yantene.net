import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Temporal, toTemporalInstant } from "@js-temporal/polyfill";
import { IndexQueryRequest } from "../../requests/notes/index-query.request";
import { NotesIndexResponse } from "../../responses/notes/notes-index.response";
import { NotesShowResponse } from "../../responses/notes/notes-show.response";
import { NotesUseCase } from "../../../domain/use-cases/notes/notes.use-case";
import { NoteTitle } from "../../../domain/aggregates/notes/value-objects/note-title.value-object";
import { ExhaustiveError } from "../../../common/errors/exhaustive.error";
import { Note } from "../../../domain/aggregates/notes/entities/note.entity";

@ApiTags("notes")
@Controller("notes")
export class NotesController {
  readonly #notesUseCase: NotesUseCase;

  constructor(notesUseCase: NotesUseCase) {
    this.#notesUseCase = notesUseCase;
  }

  @Get()
  @ApiOkResponse({ description: "OK", type: NotesIndexResponse })
  @ApiBadRequestResponse({ description: "BadRequest" })
  async index(
    @Query() indexQuery: IndexQueryRequest,
  ): Promise<NotesIndexResponse> {
    const { limit, order, cursor } = indexQuery;

    const { notes, nextCursor } = await (async (): Promise<{
      notes: Note[];
      nextCursor: Temporal.Instant;
    }> => {
      switch (order) {
        case "newest":
        case "oldest":
          return this.#notesUseCase.findNotesByCreatedAt(
            limit,
            order === "newest" ? "desc" : "asc",
            cursor && toTemporalInstant.bind(cursor)(),
          );
        case "recently-modified":
        case "least-recently-modified":
          return this.#notesUseCase.findNotesByCreatedAt(
            limit,
            order === "recently-modified" ? "desc" : "asc",
            cursor && toTemporalInstant.bind(cursor)(),
          );
        default:
          throw new ExhaustiveError(order);
      }
    })();

    return {
      notes: notes.map((note) => ({
        title: note.title.value,
        createdAt: note.createdAt.toString(),
        modifiedAt: note.modifiedAt.toString(),
      })),
      nextCursor: nextCursor.toString(),
    };
  }

  // TODO: API spec for title param
  @Get(":title")
  @ApiOkResponse({ description: "OK", type: NotesShowResponse })
  @ApiNotFoundResponse({ description: "Not Found" })
  async show(@Param("title") title: string): Promise<NotesShowResponse> {
    const { note, linkingNotes, linkedNotes } =
      await this.#notesUseCase.findNote(new NoteTitle(title));

    if (!note) throw new NotFoundException();

    return {
      note: {
        title: note.title.value,
        createdAt: note.createdAt.toString(),
        modifiedAt: note.modifiedAt.toString(),
        body: note.body.value,
        linkingNotes: linkingNotes.map((linkingNote) => ({
          title: linkingNote.title.value,
          createdAt: linkingNote.createdAt.toString(),
          modifiedAt: linkingNote.modifiedAt.toString(),
        })),
        linkedNotes: linkedNotes.map((linkedNote) => ({
          title: linkedNote.title.value,
          createdAt: linkedNote.createdAt.toString(),
          modifiedAt: linkedNote.modifiedAt.toString(),
        })),
      },
    };
  }
}
