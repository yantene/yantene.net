import {
  Controller,
  DefaultValuePipe,
  Get,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  Query,
} from "@nestjs/common";
import { ApiQuery, ApiTags } from "@nestjs/swagger";
import { TagsService } from "../../../domain/tags/tags.service";
import { NotesService } from "../../../domain/notes/notes.service";
import { Cursor } from "./dto/cursor.input";
import { Limit } from "./dto/limit.input";
import { Order } from "./dto/order.input";

@ApiTags("notes", "tags")
@Controller("tags/:name")
export class TagsNotesController {
  constructor(
    private readonly tagsService: TagsService,
    private readonly notesService: NotesService,
  ) {}

  @ApiQuery({ name: "limit", type: Limit })
  @ApiQuery({ name: "order", type: Order })
  @ApiQuery({ name: "cursor", type: Cursor })
  @Get("notes")
  findOne(
    @Param("name") tagName: string,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query("order", new DefaultValuePipe("newest")) order: string,
    @Query("cursor") cursor: string,
  ) {
    if (!this.tagsService.exist(tagName)) {
      throw new HttpException("Not Found", HttpStatus.NOT_FOUND);
    }

    return this.notesService.findAll(limit, order, cursor, [tagName]);
  }
}
