import type { IValueObject } from "~/backend/domain/shared";
import type { LifeEventDate } from "./life-event-date.vo";

/*
 * これまでにあった出来事。`/about` のタイムラインに並ぶ。
 *
 * `kind` は閉じた集合にしない。年別アーカイブ (#414) が生年・入学年・入社年を
 * `birth` / `school-entry` / `employment` で拾う一方、拾われない出来事も書けてよい。
 * 知らない kind を弾くと、書き手が新しい種類を思いつくたびにコードを直すことになる。
 */
const KIND_PATTERN = /^[a-z0-9-]+$/u;
const MAX_KIND_LENGTH = 50;
const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 500;

export class InvalidLifeEventError extends Error {
  readonly name = "InvalidLifeEventError";
}

interface LifeEventFields {
  readonly date: LifeEventDate;
  readonly kind: string;
  readonly title: string;
  readonly description: string | undefined;
}

export class LifeEvent implements IValueObject<LifeEvent> {
  private constructor(private readonly fields: LifeEventFields) {}

  static create(params: {
    date: LifeEventDate;
    kind: string;
    title: string;
    description?: string;
  }): LifeEvent {
    const kind = params.kind.trim();
    if (kind.length === 0 || kind.length > MAX_KIND_LENGTH || !KIND_PATTERN.test(kind)) {
      throw new InvalidLifeEventError(
        `Life event kind must be lowercase alphanumerics and hyphens (1..${String(MAX_KIND_LENGTH)}), got ${params.kind}`,
      );
    }
    const title = params.title.trim();
    if (title.length === 0 || title.length > MAX_TITLE_LENGTH) {
      throw new InvalidLifeEventError(
        `Life event title must be 1..${String(MAX_TITLE_LENGTH)} characters long`,
      );
    }
    const description = params.description?.trim();
    if (description !== undefined && description.length > MAX_DESCRIPTION_LENGTH) {
      throw new InvalidLifeEventError(
        `Life event description must be at most ${String(MAX_DESCRIPTION_LENGTH)} characters long`,
      );
    }
    return new LifeEvent({
      date: params.date,
      kind,
      title,
      // 空文字は「説明を書かなかった」と同じ扱いにする。描画側が両方を気にせずに済む。
      description: description === undefined || description.length === 0 ? undefined : description,
    });
  }

  get date(): LifeEventDate {
    return this.fields.date;
  }

  get kind(): string {
    return this.fields.kind;
  }

  get title(): string {
    return this.fields.title;
  }

  get description(): string | undefined {
    return this.fields.description;
  }

  equals(other: LifeEvent): boolean {
    return (
      this.fields.date.equals(other.fields.date) &&
      this.fields.kind === other.fields.kind &&
      this.fields.title === other.fields.title &&
      this.fields.description === other.fields.description
    );
  }

  toJSON(): Record<string, unknown> {
    return {
      date: this.fields.date.toJSON(),
      kind: this.fields.kind,
      title: this.fields.title,
      description: this.fields.description,
    };
  }
}
