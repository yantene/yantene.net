import type { NoteSlug } from "./note-slug.vo";
import type { Note } from "./note.entity";
import type { IPersisted } from "../shared/persisted.interface";
import type { IUnpersisted } from "../shared/unpersisted.interface";

export interface INoteCommandRepository {
  save(note: Note<IUnpersisted>): Promise<Note<IPersisted>>;
  upsert(note: Note<IUnpersisted>): Promise<Note<IPersisted>>;
  delete(id: string): Promise<void>;
  deleteBySlug(slug: NoteSlug): Promise<void>;
}
