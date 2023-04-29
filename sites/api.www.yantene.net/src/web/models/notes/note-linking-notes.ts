import { ApiProperty } from "@nestjs/swagger";
import { NoteSummary } from "./note-summary";

export class NoteLinkingNotes {
  @ApiProperty({
    description: "note summaries that are linked from this note",
  })
  readonly linkingNotes: NoteSummary[];
}
