export class NoteNotFoundError extends Error {
  readonly name = "NoteNotFoundError";
  constructor(slug: string) {
    super(`Note not found: ${slug}`);
  }
}
