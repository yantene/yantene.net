export class UserNotFoundError extends Error {
  readonly name = "UserNotFoundError";
  constructor(detail: string) {
    super(`User not found: ${detail}`);
  }
}

export class DuplicateEmailError extends Error {
  readonly name = "DuplicateEmailError";
  constructor(email: string) {
    super(`Email already registered: ${email}`);
  }
}
