import { Injectable } from "@nestjs/common";

@Injectable()
export class TagsService {
  exist(name: string): boolean {
    // eslint-disable-next-line no-console
    console.log(name);

    // TODO: implement me!
    return true;
  }

  findAll(
    limit: number,
    order: string,
    notesModifiedAtCursor: string | undefined,
    taggedCursor: number | undefined,
  ) {
    // eslint-disable-next-line no-console
    console.log(limit, order, notesModifiedAtCursor, taggedCursor);

    // TODO: implement me!
    return `This action returns some tags`;
  }
}
