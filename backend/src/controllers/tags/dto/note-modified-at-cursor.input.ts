import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class NoteModifiedAtCursor {
  @ApiProperty({
    type: "string",
    format: "date-time",
  })
  @ApiPropertyOptional()
  noteModifiedAtCursor: string | undefined;
}
