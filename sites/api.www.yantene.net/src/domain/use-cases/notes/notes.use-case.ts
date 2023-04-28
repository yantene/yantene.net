import { Inject, Injectable } from "@nestjs/common";
import { NotImplementedError } from "../../../common/errors/not-implemented.error";
import { NotesRepositoryInterface } from "../../aggregates/notes/notes.repository.interface";
import { Note } from "../../aggregates/notes/entities/note.entity";

@Injectable()
export class NotesUseCase {
  readonly #notesRepository: NotesRepositoryInterface;

  constructor(
    @Inject("NotesRepositoryInterface")
    notesRepository: NotesRepositoryInterface,
  ) {
    this.#notesRepository = notesRepository;
  }

  async findNotesByCreatedAt(): Promise<Note[]> {
    throw new NotImplementedError();
  }

  async findNotesByModifiedAt(): Promise<Note[]> {
    throw new NotImplementedError();
  }

  async findNote(): Promise<Note | undefined> {
    throw new NotImplementedError();
  }
}
