import { ApiExtraModels, ApiProperty } from "@nestjs/swagger";
import { NoteSummary } from "../../models/notes/note-summary";

@ApiExtraModels(NoteSummary)
export class NotesIndexResponse {
  @ApiProperty({
    description: "value to be passed to cursor in the next request",
    format: "date-time",
    required: false,
  })
  readonly nextCursor?: string;

  @ApiProperty({
    description: "array of results",
    type: [NoteSummary],
  })
  readonly notes: NoteSummary[];
}
