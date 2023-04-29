import { ApiProperty } from "@nestjs/swagger";
import { NoteSummary } from "./note-summary";

export class NoteLinkedNotes {
  @ApiProperty({
    description: "note summaries that link to this note",
  })
  readonly linkedNotes: NoteSummary[];
}
