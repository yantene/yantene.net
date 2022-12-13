import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
} from "@nestjs/common";
import { ApiQuery, ApiTags } from "@nestjs/swagger";
import { Limit } from "../../requests/tags/limit.input";
import { NoteModifiedAtCursor } from "../../requests/tags/note-modified-at-cursor.input";
import { Order } from "../../requests/tags/order.input";
import { TaggedCursor } from "../../requests/tags/tagged-cursor.input";
import { TagsService } from "../../../domain/tags/tags.service";

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
