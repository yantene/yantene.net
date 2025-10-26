const VALID_LEVELS = ["debug", "info", "warn", "error", "fatal"] as const;

type ValidLevel = (typeof VALID_LEVELS)[number];

export class LogLevel {
  private constructor(readonly value: ValidLevel) {}

  static create(value: string): LogLevel {
    if (!LogLevel.isValidLevel(value)) {
      throw new Error(`Invalid log level: ${value}`);
    }
    return new LogLevel(value as ValidLevel);
  }

  equals(other: LogLevel): boolean {
    return this.value === other.value;
  }

  toJSON(): string {
    return this.value;
  }

  private static isValidLevel(value: string): value is ValidLevel {
    return (VALID_LEVELS as readonly string[]).includes(value);
  }
}
