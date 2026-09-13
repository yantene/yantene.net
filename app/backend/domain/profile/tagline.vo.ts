import type { IValueObject } from "~/backend/domain/shared";

/*
 * 短い自己紹介。トップのヒーロー・記事末尾の筆者紹介・`/about` の 3 か所が同じものを出す。
 *
 * 改行を含める (YAML の `|` で書く)。長文の自己紹介は本文 (Markdown) 側にあり、
 * こちらは 3 行ほどで収まる長さを想定している。Markdown としては解釈しない。
 */
const MAX_LENGTH = 500;

export class InvalidTaglineError extends Error {
  readonly name = "InvalidTaglineError";
}

export class Tagline implements IValueObject<Tagline> {
  private constructor(private readonly value: string) {}

  static create(raw: string): Tagline {
    // 末尾の改行は YAML の `|` が必ず 1 つ残すので落とす。行頭の字下げは書き手の
    // 意図なので触らない。
    const trimmed = raw.replace(/\s+$/u, "");
    if (trimmed.length === 0 || trimmed.length > MAX_LENGTH) {
      throw new InvalidTaglineError(`Tagline must be 1..${String(MAX_LENGTH)} characters long`);
    }
    return new Tagline(trimmed);
  }

  /** 行に分ける。描画側が `<br />` を挟むため。 */
  lines(): readonly string[] {
    return this.value.split("\n");
  }

  toString(): string {
    return this.value;
  }

  equals(other: Tagline): boolean {
    return this.value === other.value;
  }

  toJSON(): string {
    return this.value;
  }
}
