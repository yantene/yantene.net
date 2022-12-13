import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class Order {
  @ApiProperty({
    type: "string",
    default: "recently-tagged",
    enum: ["recently-tagged", "most-tagged"],
  })
  @ApiPropertyOptional()
  order: string | undefined;
}
