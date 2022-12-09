import { Injectable } from "@nestjs/common";

@Injectable()
export class NotesService {
  findAll() {
    return `This action returns all notes`;
  }

  findOne(id: number) {
    return `This action returns a #${id} note`;
  }
}
