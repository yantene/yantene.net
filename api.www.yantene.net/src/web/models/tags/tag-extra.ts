import { ApiProperty } from "@nestjs/swagger";

export class TagExtra {
  @ApiProperty({
    description: "number of notes associated with the tag",
    type: "integer",
    example: 1,
    minimum: 0,
  })
  readonly numberOfNotes: number;
}
