import type { IPersisted } from "../persisted.interface";
import type { NoteSlug } from "./note-slug.vo";
import type { Note } from "./note.entity";

export interface INoteQueryRepository {
  findAll(): Promise<readonly Note<IPersisted>[]>;
  findBySlug(slug: NoteSlug): Promise<Note<IPersisted> | undefined>;
}
