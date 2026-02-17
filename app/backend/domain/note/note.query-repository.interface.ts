import type { IPersisted } from "../persisted.interface";
import type { Note } from "./note.entity";
import type { NoteSlug } from "./note-slug.vo";

export interface INoteQueryRepository {
  findAll(): Promise<readonly Note<IPersisted>[]>;
  findBySlug(slug: NoteSlug): Promise<Note<IPersisted> | undefined>;
}
