export class NoteParseError extends Error {
  readonly name = "NoteParseError" as const;

  constructor(readonly fileName: string) {
    super(`Failed to parse frontmatter: ${fileName}`);
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
