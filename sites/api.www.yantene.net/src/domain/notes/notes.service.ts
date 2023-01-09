import { Injectable } from "@nestjs/common";
import { Note } from "./models/note.entity";

@Injectable()
export class NotesService {
  findAll(
    limit: number,
    order: string,
    cursor?: Date,
    tagNames?: string[],
  ): Note[] {
    // eslint-disable-next-line no-console
    console.log(limit, order, cursor, tagNames);

    // TODO: implement me!
    return [];
  }

  findOne(title: string): Note | undefined {
    // eslint-disable-next-line no-console
    console.log(title);

    // TODO: implement me!
    return undefined;
  }
}
