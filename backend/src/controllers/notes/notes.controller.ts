import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from "@nestjs/common";
import { ApiQuery, ApiTags } from "@nestjs/swagger";
import { Cursor } from "./dto/cursor.input";
import { Limit } from "./dto/limit.input";
import { Order } from "./dto/order.input";
import { NotesService } from "../../domain/notes/notes.service";

@ApiTags("notes")
@Controller("notes")
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @ApiQuery({ name: "limit", type: Limit })
  @ApiQuery({ name: "order", type: Order })
  @ApiQuery({ name: "cursor", type: Cursor })
  @Get()
  findAll(
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query("order", new DefaultValuePipe("newest")) order: string,
    @Query("cursor") cursor: string | undefined,
  ) {
    return this.notesService.findAll(limit, order, cursor);
  }

  // TODO: API spec for title param
  @Get(":title")
  findOne(@Param("title") title: string) {
    return this.notesService.findOne(title);
  }
}
