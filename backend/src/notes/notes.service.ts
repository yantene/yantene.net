import { Injectable } from "@nestjs/common";

@Injectable()
export class NotesService {
  findAll(limit: number, order: string, cursor: string | undefined) {
    console.log(limit, order, cursor);
    return `This action returns some notes`;
  }

  findOne(title: string) {
    console.log(title);
    return `This action returns a ${title} note`;
  }
}
