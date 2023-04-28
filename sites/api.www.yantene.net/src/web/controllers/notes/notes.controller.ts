import { Controller, Get, Param, Query } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from "@nestjs/swagger";
import { IndexQueryRequest } from "../../requests/notes/index-query.request";
import { NotesIndexResponse } from "../../responses/notes/notes-index.response";
import { NotesShowResponse } from "../../responses/notes/notes-show.response";
import { NotesUseCase } from "../../../domain/use-cases/notes/notes.use-case";

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
  index(@Query() _indexQuery: IndexQueryRequest): NotesIndexResponse {
    // TODO: IMPLEMENT

    return { nextCursor: "", notes: [] };
  }

  // TODO: API spec for title param
  @Get(":title")
  @ApiOkResponse({ description: "OK", type: NotesShowResponse })
  @ApiNotFoundResponse({ description: "Not Found" })
  show(@Param("title") _title: string): NotesShowResponse {
    // TODO: IMPLEMENT

    return {
      note: {
        title: "",
        tags: [],
        emoji: "",
        createdAt: "",
        modifiedAt: "",
        body: "",
      },
    };
  }
}
