import { Injectable } from "@nestjs/common";
import { Tag } from "./models/tag.entity";

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
    notesModifiedAtCursor: Date | undefined,
    taggedCursor: number | undefined,
  ): Tag[] {
    // eslint-disable-next-line no-console
    console.log(limit, order, notesModifiedAtCursor, taggedCursor);

    // TODO: implement me!
    return [];
  }
}
