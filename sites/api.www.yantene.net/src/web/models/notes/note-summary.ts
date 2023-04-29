import { ApiProperty } from "@nestjs/swagger";

export class NoteSummary {
  @ApiProperty({
    description: "note title",
    example: "徒然草52",
  })
  readonly title: string;

  @ApiProperty({
    description: "time of creation",
    format: "date-time",
    example: "2022-11-18T21:00:00+09:00",
  })
  readonly createdAt: string;

  @ApiProperty({
    description: "time of last modification",
    format: "date-time",
    example: "2022-11-18T21:00:00+09:00",
  })
  readonly modifiedAt: string;
}
