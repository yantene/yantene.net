import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class Cursor {
  @ApiProperty({
    type: "string",
    format: "date-time",
  })
  @ApiPropertyOptional()
  cursor: string | undefined;
}
