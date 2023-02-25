import { Note } from "./note.entity";
import { Title } from "./title.value-object";

export type NotesRepositoryInterface = {
  findByTitle(title: Title): Promise<Note | undefined>;
};
