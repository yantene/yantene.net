import { Temporal } from "@js-temporal/polyfill";
import { PersistentNote, TransientNote } from "./entities/note.entity";
import { NoteTitle } from "./value-objects/note-title.value-object";
import { NoteId } from "./value-objects/note-id.value-object";

export type NotesRepositoryInterface = {
  /**
   * Finds and returns notes.
   * The order of the notes is based on the createdAt property.
   *
   * @param order - Order of the notes to find
   * @param limit - Limit of the notes to find
   * @param cursor - Cursor of the notes to find
   * @returns Found notes
   */
  findByCreatedAt(
    order: "desc" | "asc",
    limit: number,
    cursor?: Temporal.Instant,
  ): Promise<PersistentNote[]>;

  /**
   * Finds and returns notes.
   * The order of the notes is based on the modifiedAt property.
   *
   * @param order - Order of the notes to find
   * @param limit - Limit of the notes to find
   * @param cursor - Cursor of the notes to find
   * @returns Found notes
   */
  findByModifiedAt(
    order: "desc" | "asc",
    limit: number,
    cursor?: Temporal.Instant,
  ): Promise<PersistentNote[]>;

  /**
   * Finds and returns one note by id or title.
   *
   * @param idOrTitle - Id or title of the note to find
   * @returns Found note or undefined
   */
  findOne(idOrTitle: NoteId | NoteTitle): Promise<PersistentNote | undefined>;

  /**
   * Finds and returns notes by ids or titles.
   *
   * @param idsOrTitles - Ids or titles of the notes to find
   * @returns Found notes
   */
  findMany(idsOrTitles: NoteId[] | NoteTitle[]): Promise<PersistentNote[]>;

  /**
   * Creates a note.
   *
   * @param note - Note to create
   * @returns Created note
   */
  create(note: TransientNote): Promise<PersistentNote>;

  /**
   * Updates a note.
   *
   * @param note - Note to update
   * @returns Updated note
   */
  update(note: PersistentNote): Promise<PersistentNote>;

  /**
   * Destroys a note.
   *
   * @param idOrTitle - Id or title of the note to destroy
   * @returns Destroyed note or undefined
   */
  destroy(idOrTitle: NoteId | NoteTitle): Promise<PersistentNote | undefined>;

  /**
   * Finds and returns notes linked to the note.
   *
   * @param idOrTitle - Id or title of the note to find linked notes
   * @returns Found notes
   */
  findLinkedNotes(idOrTitle: NoteId | NoteTitle): Promise<PersistentNote[]>;

  /**
   * Finds and returns notes backlinked to the note.
   *
   * @param idOrTitle - Id or title of the note to find backlinked notes
   * @returns Found notes
   */
  findBacklinkedNotes(idOrTitle: NoteId | NoteTitle): Promise<PersistentNote[]>;
};
