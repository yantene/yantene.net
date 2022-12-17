import { Controller, Get, Param, Query } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from "@nestjs/swagger";
import { NotesService } from "../../../domain/notes/notes.service";
import { IndexQueryRequest } from "../../requests/notes/index-query.request";
import { NotesIndexResponse } from "../../responses/notes/notes-index.response";
import { NotesShowResponse } from "../../responses/notes/notes-show.response";

@ApiTags("notes")
@Controller("notes")
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get()
  @ApiOkResponse({ description: "OK", type: NotesIndexResponse })
  @ApiBadRequestResponse({ description: "BadRequest" })
  index(@Query() indexQuery: IndexQueryRequest): NotesIndexResponse {
    this.notesService.findAll(
      indexQuery.limit,
      indexQuery.order,
      indexQuery.cursor,
    );

    return { nextCursor: "", notes: [] };
  }

  // TODO: API spec for title param
  @Get(":title")
  @ApiOkResponse({ description: "OK", type: NotesShowResponse })
  @ApiNotFoundResponse({ description: "Not Found" })
  show(@Param("title") title: string): NotesShowResponse {
    this.notesService.findOne(title);

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
