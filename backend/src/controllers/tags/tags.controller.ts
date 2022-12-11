import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
} from "@nestjs/common";
import { ApiQuery, ApiTags } from "@nestjs/swagger";
import { Limit } from "./dto/limit.input";
import { NoteModifiedAtCursor } from "./dto/note-modified-at-cursor.input";
import { Order } from "./dto/order.input";
import { TaggedCursor } from "./dto/tagged-cursor.input";
import { TagsService } from "../../domain/tags/tags.service";

@ApiTags("tags")
@Controller("tags")
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @ApiQuery({ name: "limit", type: Limit })
  @ApiQuery({ name: "order", type: Order })
  @ApiQuery({ name: "noteModifiedAtCursor", type: NoteModifiedAtCursor })
  @ApiQuery({ name: "taggedCursor", type: TaggedCursor })
  @Get()
  findAll(
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query("order", new DefaultValuePipe("recently-tagged")) order: string,
    @Query("noteModifiedAtCursor") noteModifiedAtCursor: string | undefined,
    @Query("taggedCursor", ParseIntPipe) taggedCursor: number | undefined,
  ) {
    return this.tagsService.findAll(
      limit,
      order,
      noteModifiedAtCursor,
      taggedCursor,
    );
  }
}
