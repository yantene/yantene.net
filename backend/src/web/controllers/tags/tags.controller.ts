import { Controller, Get, Query } from "@nestjs/common";
import { ApiBadRequestResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { TagsIndexResponse } from "../../responses/tags/tags-index.response";
import { TagsService } from "../../../domain/tags/tags.service";
import { IndexQueryRequest } from "../../requests/tags/index-query.request";

@ApiTags("tags")
@Controller("tags")
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  @ApiOkResponse({ description: "OK", type: TagsIndexResponse })
  @ApiBadRequestResponse({ description: "BadRequest" })
  index(@Query() indexQuery: IndexQueryRequest): TagsIndexResponse {
    this.tagsService.findAll(
      indexQuery.limit,
      indexQuery.order,
      indexQuery.noteModifiedAtCursor,
      indexQuery.taggedCursor,
    );

    return {
      nextNoteModifiedAtCursor: "",
      nextTaggedCursor: 0,
      tags: [],
    };
  }
}
