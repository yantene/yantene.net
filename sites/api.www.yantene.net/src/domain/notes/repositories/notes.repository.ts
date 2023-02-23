import { PrismaClient } from "@prisma/client";
import { toTemporalInstant } from "@js-temporal/polyfill";
import { Note } from "../models/note.entity";
import { NotesRepositoryInterface } from "../models/notes.repository.interface";
import { Title } from "../models/title.value-object";
import { Body } from "../models/body.value-object";

export class NotesRepository implements NotesRepositoryInterface {
  #prisma: PrismaClient;

  constructor() {
    this.#prisma = new PrismaClient();
  }

  async findByTitle(title: Title): Promise<Note | undefined> {
    const foundNote = await this.#prisma.note.findUnique({
      where: { title: title.value },
    });

    if (foundNote == null) {
      return undefined;
    }

    const note = new Note(
      new Title(foundNote.title),
      toTemporalInstant.bind(foundNote.createdAt)(),
      toTemporalInstant.bind(foundNote.modifiedAt)(),
      new Body(foundNote.body),
    );

    return note;
  }
}
