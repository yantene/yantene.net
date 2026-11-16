import type { IValueObject } from "~/backend/domain/shared";

/*
 * その作品での自分の役割。1 行。
 *
 * 改行を入れないのは概要 (`WorkSummary`) と同じ理由で、並ぶのは札の隣の 1 行なので、
 * 書き手が折り返しを決める場所ではない。
 */
const MAX_LENGTH = 200;

export class InvalidWorkRoleError extends Error {
  readonly name = "InvalidWorkRoleError";
}

export class WorkRole implements IValueObject<WorkRole> {
  private constructor(private readonly value: string) {}

  static create(raw: string): WorkRole {
    const trimmed = raw.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_LENGTH) {
      throw new InvalidWorkRoleError(`Work role must be 1..${String(MAX_LENGTH)} characters long`);
    }
    if (trimmed.includes("\n")) {
      throw new InvalidWorkRoleError("Work role must be a single line");
    }
    return new WorkRole(trimmed);
  }

  toString(): string {
    return this.value;
  }

  equals(other: WorkRole): boolean {
    return this.value === other.value;
  }

  toJSON(): string {
    return this.value;
  }
}
