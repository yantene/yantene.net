import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { NotesService } from "../../../domain/notes/notes.service";
import { IndexQueryRequest } from "../../requests/notes/index-query.request";

@ApiTags("notes")
@Controller("notes")
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get()
  index(@Query() indexQuery: IndexQueryRequest) {
    return this.notesService.findAll(
      indexQuery.limit,
      indexQuery.order,
      indexQuery.cursor,
    );
  }

  // TODO: API spec for title param
  @Get(":title")
  findOne(@Param("title") title: string) {
    return this.notesService.findOne(title);
  }
}
