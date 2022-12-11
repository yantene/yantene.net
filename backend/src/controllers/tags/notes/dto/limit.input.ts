import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class Limit {
  @ApiProperty({
    type: "integer",
    default: 20,
    minimum: 1,
    maximum: 200,
  })
  @ApiPropertyOptional()
  limit: number;
}
