import { ApiExtraModels, ApiProperty, getSchemaPath } from "@nestjs/swagger";
import { NoteSummary } from "../../models/notes/note-summary";
import { NoteExtra } from "../../models/notes/note-extra";

@ApiExtraModels(NoteSummary, NoteExtra)
export class NotesShowResponse {
  @ApiProperty({
    description: "note",
    allOf: [
      { $ref: getSchemaPath(NoteSummary) },
      { $ref: getSchemaPath(NoteExtra) },
    ],
  })
  readonly note: NoteSummary | NoteExtra;
}
