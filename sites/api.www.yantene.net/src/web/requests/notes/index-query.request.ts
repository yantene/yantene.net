import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, Min, Max, IsIn, IsOptional, IsDate } from "class-validator";

export class IndexQueryRequest {
  @ApiProperty({
    type: "integer",
    default: 20,
    minimum: 1,
    maximum: 200,
    required: false,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  readonly limit: number = 20;

  @ApiProperty({
    type: "string",
    default: "newest",
    enum: ["newest", "oldest", "recently-modified", "least-recently-modified"],
    required: false,
  })
  @IsIn(["newest", "oldest", "recently-modified", "least-recently-modified"])
  readonly order: string = "newest";

  @ApiProperty({
    type: "string",
    format: "date-time",
    required: false,
  })
  @Type(() => Date)
  @IsOptional()
  @IsDate()
  readonly cursor?: Date;
}
