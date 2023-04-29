import { ApiExtraModels, ApiProperty, getSchemaPath } from "@nestjs/swagger";
import { NoteSummary } from "../../models/notes/note-summary";
import { NoteExtra } from "../../models/notes/note-extra";
import { NoteLinkingNotes } from "../../models/notes/note-linking-notes";
import { NoteLinkedNotes } from "../../models/notes/note-linked-notes";

@ApiExtraModels(NoteSummary, NoteExtra)
export class NotesShowResponse {
  @ApiProperty({
    description: "note",
    allOf: [
      { $ref: getSchemaPath(NoteSummary) },
      { $ref: getSchemaPath(NoteExtra) },
      { $ref: getSchemaPath(NoteLinkingNotes) },
      { $ref: getSchemaPath(NoteLinkedNotes) },
    ],
  })
  readonly note: NoteSummary | NoteExtra | NoteLinkingNotes | NoteLinkedNotes;
}
