import { Controller, Get, Query } from "@nestjs/common";
import { ApiBadRequestResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { TagsService } from "../../../domain/tags/tags.service";
import { IndexQueryRequest } from "../../requests/tags/index-query.request";

@ApiTags("tags")
@Controller("tags")
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  @ApiOkResponse({ description: "OK" })
  @ApiBadRequestResponse({ description: "BadRequest" })
  index(@Query() indexQuery: IndexQueryRequest) {
    return this.tagsService.findAll(
      indexQuery.limit,
      indexQuery.order,
      indexQuery.noteModifiedAtCursor,
      indexQuery.taggedCursor,
    );
  }
}
