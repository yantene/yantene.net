import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Query,
} from "@nestjs/common";
import { ApiBadRequestResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { TagsService } from "../../../../domain/tags/tags.service";
import { NotesService } from "../../../../domain/notes/notes.service";
import { IndexQueryRequest } from "../../../requests/notes/index-query.request";
import { NotesIndexResponse } from "../../../responses/notes/notes-index.response";

@ApiTags("notes", "tags")
@Controller("tags/:name")
export class TagsNotesController {
  constructor(
    private readonly tagsService: TagsService,
    private readonly notesService: NotesService,
  ) {}

  @Get("notes")
  @ApiOkResponse({ description: "OK", type: NotesIndexResponse })
  @ApiBadRequestResponse({ description: "BadRequest" })
  index(
    @Param("name") tagName: string,
    @Query() indexQuery: IndexQueryRequest,
  ): NotesIndexResponse {
    if (!this.tagsService.exist(tagName)) {
      throw new HttpException("Not Found", HttpStatus.NOT_FOUND);
    }

    this.notesService.findAll(
      indexQuery.limit,
      indexQuery.order,
      indexQuery.cursor,
      [tagName],
    );

    return {
      nextCursor: "",
      notes: [],
    };
  }
}
