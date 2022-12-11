import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class Order {
  @ApiProperty({
    type: "string",
    default: "newest",
    enum: ["newest", "oldest", "recently-modified", "least-recently-modified"],
  })
  @ApiPropertyOptional()
  order: string;
}
