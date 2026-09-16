import type { IValueObject } from "~/backend/domain/shared";

/*
 * 経歴の 1 件。「いつ・何が起きたか」と、それがどの章に属するか。
 *
 * **章 (`chapter`) は暦年ではなく書き手が決める区切り**である (高校・大学・社会人)。
 * 暦年で束ねると、同じ年に 4 件寄る一方で何も無い年が空き、卒業と入学が同じ束に混ざる。
 * 章を各件が持つのは、`profile_socials` と同じ平らな行として保存できる形にするため。
 * 束ね直すのは出す側 (`toPublicHistory`) で、現れた順に畳む。
 *
 * **年だけを持ち、月日と期間は持たない。** 年表に載るのは点の出来事なので、続いて
 * いることは始まった年の出来事として書く。範囲を持つと、左の柱に出す札が「2018–」の
 * ような字になり、読み上げでも横並びでも意味を取りにくくなる。
 *
 * ⚠️ **h-card にも JSON-LD にも出さない** (ADR 0044)。経歴は読み物として出すもので、
 * 機械に名乗る身元の一部ではない。生年月日と出身地を機械が読む形で持たないこと (#508) と
 * 同じ線引きなので、`dt-*` や `alumniOf` を足さないこと。
 */
const MAX_CHAPTER_LENGTH = 40;
const MAX_TEXT_LENGTH = 200;
const MAX_NOTE_LENGTH = 200;
const MAX_URL_LENGTH = 2048;
/* 西暦 4 桁。打ち間違い (`20112` や `11`) をその場で止めるための枠でしかない。 */
const MIN_YEAR = 1000;
const MAX_YEAR = 9999;

export class InvalidHistoryEntryError extends Error {
  readonly name = "InvalidHistoryEntryError";
}

interface HistoryEntryFields {
  readonly chapter: string;
  readonly year: number;
  readonly text: string;
  readonly url: string | undefined;
  readonly note: string | undefined;
}

export class HistoryEntry implements IValueObject<HistoryEntry> {
  private constructor(private readonly fields: HistoryEntryFields) {}

  static create(params: {
    chapter: string;
    year: number;
    text: string;
    url?: string;
    note?: string;
  }): HistoryEntry {
    return new HistoryEntry({
      chapter: requireText(params.chapter, "chapter", MAX_CHAPTER_LENGTH),
      year: validateYear(params.year),
      text: requireText(params.text, "text", MAX_TEXT_LENGTH),
      url: params.url === undefined ? undefined : validateUrl(params.url),
      note:
        params.note === undefined ? undefined : requireText(params.note, "note", MAX_NOTE_LENGTH),
    });
  }

  get chapter(): string {
    return this.fields.chapter;
  }

  get year(): number {
    return this.fields.year;
  }

  get text(): string {
    return this.fields.text;
  }

  get url(): string | undefined {
    return this.fields.url;
  }

  get note(): string | undefined {
    return this.fields.note;
  }

  equals(other: HistoryEntry): boolean {
    return (
      this.fields.chapter === other.fields.chapter &&
      this.fields.year === other.fields.year &&
      this.fields.text === other.fields.text &&
      this.fields.url === other.fields.url &&
      this.fields.note === other.fields.note
    );
  }

  toJSON(): Record<string, unknown> {
    return {
      chapter: this.fields.chapter,
      year: this.fields.year,
      text: this.fields.text,
      url: this.fields.url,
      note: this.fields.note,
    };
  }
}

function requireText(raw: string, field: string, maxLength: number): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) {
    throw new InvalidHistoryEntryError(
      `History ${field} must be 1..${String(maxLength)} characters long`,
    );
  }
  return trimmed;
}

/**
 * 年は数として受ける。
 *
 * `"2012"` や `2012 年` を通さないのは、書き手が書いた値をこちらで解釈し始めると、
 * `2012 年ごろ` のような字も «たぶん 2012» として通ってしまうため。枠に入らない値は
 * その場で同期を止めて理由を返す。
 */
function validateYear(raw: number): number {
  if (!Number.isInteger(raw) || raw < MIN_YEAR || raw > MAX_YEAR) {
    throw new InvalidHistoryEntryError(
      `History year must be an integer in ${String(MIN_YEAR)}..${String(MAX_YEAR)}, got ${JSON.stringify(raw)}`,
    );
  }
  return raw;
}

/**
 * 出来事に添える行き先。スキームは http(s) だけ通す。
 *
 * `javascript:` を弾くのが目的。コンテンツリポジトリに書けるのは書き手だけだが、打ち間違いが
 * そのまま href に乗る経路をドメインの外に作らない (`WorkUrl` と同じ線引き)。
 */
function validateUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_URL_LENGTH) {
    throw new InvalidHistoryEntryError(
      `History url must be 1..${String(MAX_URL_LENGTH)} characters long`,
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new InvalidHistoryEntryError(`History url must be an absolute URL, got ${trimmed}`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new InvalidHistoryEntryError(`History url must be http(s), got ${parsed.protocol}`);
  }
  return trimmed;
}
