import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class TaggedCursor {
  @ApiProperty({
    type: "integer",
    minimum: 0,
  })
  @ApiPropertyOptional()
  taggedCursor: number;
}
