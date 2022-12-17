import { ApiExtraModels, ApiProperty, IntersectionType } from "@nestjs/swagger";
import { TagSummary } from "../../models/tags/tag-summary";
import { TagExtra } from "../../models/tags/tag-extra";

@ApiExtraModels(TagSummary, TagExtra)
export class TagsIndexResponse {
  @ApiProperty({
    description:
      "value to be passed to noteModifiedAtCursor in the next request",
    format: "date-time",
    required: false,
  })
  readonly nextNoteModifiedAtCursor: string;

  @ApiProperty({
    description: "value to be passed to taggedCursor in the next request",
    type: "integer",
    required: false,
  })
  readonly nextTaggedCursor: number;

  @ApiProperty({
    description: "array of results",
    type: [IntersectionType(TagSummary, TagExtra)],
  })
  readonly tags: (TagSummary | TagExtra)[];
}
