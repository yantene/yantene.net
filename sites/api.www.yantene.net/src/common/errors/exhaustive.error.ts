/**
 * @see {@link https://typescriptbook.jp/reference/statements/never#例外による網羅性チェック}
 */
export class ExhaustiveError extends Error {
  constructor(value: never, message = `Unsupported type: ${value}.`) {
    super(message);
    this.name = "ExhaustiveError";
  }
}
