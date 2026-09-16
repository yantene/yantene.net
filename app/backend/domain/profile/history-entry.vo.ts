import type { IValueObject } from "~/backend/domain/shared";
import type { HistoryDate } from "./history-date.vo";

/*
 * 経歴の 1 件。「いつ・何が起きたか」と、それがどの章に属するか。
 *
 * **章 (`chapter`) は暦年ではなく書き手が決める区切り**である (高校・大学・社会人)。
 * 暦年で束ねると、同じ年に 4 件寄る一方で何も無い年が空き、卒業と入学が同じ束に混ざる。
 * 章を各件が持つのは、`profile_socials` と同じ平らな行として保存できる形にするため。
 * 束ね直すのは出す側 (`toPublicHistory`) で、現れた順に畳む。
 *
 * **日は `HistoryDate` が 3 段の精度で持つ** (年だけ・月まで・日まで)。終わりのある
 * 出来事は `until` を添える。終わりだけを書くことはできない。
 *
 * ⚠️ **h-card にも JSON-LD にも出さない** (ADR 0044)。経歴は読み物として出すもので、
 * 機械に名乗る身元の一部ではない。生年月日と出身地を機械が読む形で持たないこと (#508) と
 * 同じ線引きなので、`dt-*` や `alumniOf` を足さないこと。
 */
const MAX_CHAPTER_LENGTH = 40;
const MAX_TEXT_LENGTH = 200;
const MAX_NOTE_LENGTH = 200;
const MAX_URL_LENGTH = 2048;

export class InvalidHistoryEntryError extends Error {
  readonly name = "InvalidHistoryEntryError";
}

interface HistoryEntryFields {
  readonly chapter: string;
  readonly date: HistoryDate;
  /** 終わり。書いていなければ点の出来事。 */
  readonly until: HistoryDate | undefined;
  readonly text: string;
  readonly url: string | undefined;
  readonly note: string | undefined;
}

export class HistoryEntry implements IValueObject<HistoryEntry> {
  private constructor(private readonly fields: HistoryEntryFields) {}

  static create(params: {
    chapter: string;
    date: HistoryDate;
    until?: HistoryDate;
    text: string;
    url?: string;
    note?: string;
  }): HistoryEntry {
    return new HistoryEntry({
      chapter: requireText(params.chapter, "chapter", MAX_CHAPTER_LENGTH),
      date: params.date,
      until: params.until === undefined ? undefined : validateUntil(params.date, params.until),
      text: requireText(params.text, "text", MAX_TEXT_LENGTH),
      url: params.url === undefined ? undefined : validateUrl(params.url),
      note:
        params.note === undefined ? undefined : requireText(params.note, "note", MAX_NOTE_LENGTH),
    });
  }

  get chapter(): string {
    return this.fields.chapter;
  }

  get date(): HistoryDate {
    return this.fields.date;
  }

  /** 書いていなければ undefined。点の出来事になる。 */
  get until(): HistoryDate | undefined {
    return this.fields.until;
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
      this.fields.date.equals(other.fields.date) &&
      this.fields.until?.toString() === other.fields.until?.toString() &&
      this.fields.text === other.fields.text &&
      this.fields.url === other.fields.url &&
      this.fields.note === other.fields.note
    );
  }

  toJSON(): Record<string, unknown> {
    return {
      chapter: this.fields.chapter,
      date: this.fields.date.toJSON(),
      until: this.fields.until?.toJSON(),
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
 * 終わりの日。
 *
 * **始まりと同じ精度でなければ通さない。** `date: 2012-08-14` に `until: 2012-08` を
 * 書けると、どこまで分かっているのかが読み手にも機械にも取れなくなる。
 *
 * **始まりより後でなければ通さない。** 同じ日を終わりに書くのは点の出来事なので、
 * `until` を消すのが正しい。
 */
function validateUntil(date: HistoryDate, until: HistoryDate): HistoryDate {
  if (date.precision !== until.precision) {
    throw new InvalidHistoryEntryError(
      `History until must have the same precision as date (${date.precision}), got ${until.precision}`,
    );
  }
  if (date.compare(until) >= 0) {
    throw new InvalidHistoryEntryError(
      `History until must come after date, got ${date.toString()} and ${until.toString()}`,
    );
  }
  return until;
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
