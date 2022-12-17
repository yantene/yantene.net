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
    default: "recently-tagged",
    enum: ["recently-tagged", "most-tagged"],
    required: false,
  })
  @IsIn(["recently-tagged", "most-tagged"])
  readonly order: string = "recently-tagged";

  @ApiProperty({
    type: "string",
    format: "date-time",
    required: false,
  })
  @Type(() => Date)
  @IsOptional()
  @IsDate()
  readonly noteModifiedAtCursor?: Date;

  @ApiProperty({
    type: "integer",
    minimum: 0,
    required: false,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  readonly taggedCursor?: number;
}
