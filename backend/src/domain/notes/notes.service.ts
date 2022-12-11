import { Injectable } from "@nestjs/common";

@Injectable()
export class NotesService {
  findAll(
    limit: number,
    order: string,
    cursor: string | undefined,
    tagNames?: string[],
  ) {
    // eslint-disable-next-line no-console
    console.log(limit, order, cursor, tagNames);

    // TODO: implement me!
    return `This action returns some notes`;
  }

  findOne(title: string) {
    // eslint-disable-next-line no-console
    console.log(title);

    // TODO: implement me!
    return `This action returns a ${title} note`;
  }
}
