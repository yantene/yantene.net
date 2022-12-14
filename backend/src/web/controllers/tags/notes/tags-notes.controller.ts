import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Query,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { TagsService } from "../../../../domain/tags/tags.service";
import { NotesService } from "../../../../domain/notes/notes.service";
import { IndexQueryRequest } from "../../../requests/notes/index-query.request";

@ApiTags("notes", "tags")
@Controller("tags/:name")
export class TagsNotesController {
  constructor(
    private readonly tagsService: TagsService,
    private readonly notesService: NotesService,
  ) {}

  @Get("notes")
  index(
    @Param("name") tagName: string,
    @Query() indexQuery: IndexQueryRequest,
  ) {
    if (!this.tagsService.exist(tagName)) {
      throw new HttpException("Not Found", HttpStatus.NOT_FOUND);
    }

    return this.notesService.findAll(
      indexQuery.limit,
      indexQuery.order,
      indexQuery.cursor,
      [tagName],
    );
  }
}
