export class NoteParseError extends Error {
  readonly name = "NoteParseError" as const;

  constructor(readonly fileName: string) {
    super(`Failed to parse frontmatter: ${fileName}`);
  }
}

export class InvalidNoteSlugError extends Error {
  readonly name = "InvalidNoteSlugError" as const;

  constructor(readonly value: string) {
    super(`Invalid note slug: ${value}`);
  }
}

export class InvalidNoteTitleError extends Error {
  readonly name = "InvalidNoteTitleError" as const;

  constructor(readonly value: string) {
    super(`Invalid note title: ${value}`);
  }
}

export class InvalidImageUrlError extends Error {
  readonly name = "InvalidImageUrlError" as const;

  constructor(readonly value: string) {
    super(`Invalid image URL: ${value}`);
  }
}

export class NoteMetadataValidationError extends Error {
  readonly name = "NoteMetadataValidationError" as const;

  constructor(
    readonly fileName: string,
    readonly missingFields: readonly string[],
  ) {
    super(
      `Missing required metadata fields in ${fileName}: ${missingFields.join(", ")}`,
    );
  }
}
