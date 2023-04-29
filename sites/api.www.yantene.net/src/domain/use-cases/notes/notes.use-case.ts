import { Inject, Injectable } from "@nestjs/common";
import { Temporal } from "@js-temporal/polyfill";
import { NotImplementedError } from "../../../common/errors/not-implemented.error";
import { NotesRepositoryInterface } from "../../aggregates/notes/notes.repository.interface";
import { Note } from "../../aggregates/notes/entities/note.entity";
import { NoteId } from "../../aggregates/notes/value-objects/note-id.value-object";
import { NoteTitle } from "../../aggregates/notes/value-objects/note-title.value-object";
import { NotePath } from "../../aggregates/notes/value-objects/note-path.value-object";
import { NoteBody } from "../../aggregates/notes/value-objects/note-body.value-object";

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

  async findNote(
    title: NoteTitle,
  ): Promise<
    | { note: Note; linkingNotes: Note[]; linkedNotes: Note[] }
    | { note: undefined; linkingNotes: []; linkedNotes: [] }
  > {
    // TODO: IMPLEMENT (dummy implementation)

    function createDummyNote(
      dummyId: NoteId,
      dummyTitle: NoteTitle,
      linkingNoteIds: NoteId[],
    ): Note {
      return Note.buildPersistent(
        dummyId,
        dummyTitle,
        new NotePath("/path/to/note.md"),
        Temporal.Instant.fromEpochSeconds(0),
        Temporal.Instant.fromEpochSeconds(0),
        new NoteBody("body"),
        [],
        linkingNoteIds,
      );
    }

    if (title.value.startsWith("not-found")) {
      return { note: undefined, linkingNotes: [], linkedNotes: [] };
    }

    const note = createDummyNote(new NoteId(BigInt(0)), title, [
      new NoteId(BigInt("1")),
    ]);

    return {
      note,
      linkingNotes: note.linkingNoteIds.map((id) =>
        createDummyNote(id, new NoteTitle(`linking note ${id.value}`), []),
      ),
      linkedNotes: [
        createDummyNote(
          new NoteId(BigInt("2")),
          new NoteTitle("linked note 2"),
          [],
        ),
      ],
    };
  }
}
