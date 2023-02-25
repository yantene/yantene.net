import { PrismaClient } from "@prisma/client";
import { Temporal, toTemporalInstant } from "@js-temporal/polyfill";
import { Note } from "../models/note.entity";
import { NotesRepositoryInterface } from "../models/notes.repository.interface";
import { Title } from "../models/title.value-object";
import { Body } from "../models/body.value-object";

export class NotesRepository implements NotesRepositoryInterface {
  #prisma: PrismaClient;

  constructor() {
    this.#prisma = new PrismaClient();
  }

  async create(title: Title, body: Body): Promise<Note> {
    const timestamp = Temporal.Now.instant();

    const createdNote = await this.#prisma.note.create({
      data: {
        title: title.value,
        body: body.value,
        createdAt: new Date(timestamp.epochMilliseconds),
        modifiedAt: new Date(timestamp.epochMilliseconds),
      },
    });

    const note = this.#toNoteEntity(createdNote);

    return note;
  }

  async findByTitle(title: Title): Promise<Note | undefined> {
    const foundNote = await this.#prisma.note.findUnique({
      where: { title: title.value },
    });

    if (foundNote == null) {
      return undefined;
    }

    const note = this.#toNoteEntity(foundNote);

    return note;
  }

  #toNoteEntity(prismaNote: any): Note {
    return new Note(
      new Title(prismaNote.title),
      new Body(prismaNote.body),
      toTemporalInstant.bind(prismaNote.createdAt)(),
      toTemporalInstant.bind(prismaNote.modifiedAt)(),
    );
  }
}
