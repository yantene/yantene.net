import { Note } from "../models/note.entity";
import { NotesRepositoryInterface } from "../models/notes.repository.interface";
import { Title } from "../models/title.value-object";

export class NotesRepository implements NotesRepositoryInterface {
  findByTitle(_title: Title): Promise<Note | undefined> {
    // TODO: implement me!
    return (async (): Promise<undefined> => undefined)();
  }
}
