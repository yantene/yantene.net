import type { NoteTimelineItemProps } from "./note-timeline-item";

/**
 * `/api/v1/notes` から返る JSON を、タイムラインが扱える形に読み取る。
 *
 * 相手はネットワーク越しの unknown なので、型注釈で押し通さずに 1 つずつ確かめる。
 * 形が違えば null を返し、呼び出し側が読み込み失敗として扱う。
 */
export interface NoteListPayload {
  readonly notes: readonly NoteTimelineItemProps[];
  readonly totalPages: number;
}

export function parseNoteListPayload(value: unknown): NoteListPayload | null {
  if (!isRecord(value)) return null;

  const pagination = value["pagination"];
  if (!isRecord(pagination)) return null;
  const totalPages = pagination["totalPages"];
  if (typeof totalPages !== "number" || !Number.isFinite(totalPages)) {
    return null;
  }

  const rawNotes = value["notes"];
  if (!Array.isArray(rawNotes)) return null;

  const notes: NoteTimelineItemProps[] = [];
  for (const raw of rawNotes) {
    const note = parseNote(raw);
    if (note === null) return null;
    notes.push(note);
  }
  return { notes, totalPages };
}

function parseNote(value: unknown): NoteTimelineItemProps | null {
  if (!isRecord(value)) return null;

  const { slug, title, summary, imageUrl, publishedOn } = value;
  if (typeof slug !== "string") return null;
  if (typeof title !== "string") return null;
  if (typeof summary !== "string") return null;
  if (typeof publishedOn !== "string") return null;
  // 画像はないこともある。文字列か null 以外は形が違うとみなす。
  if (imageUrl !== null && typeof imageUrl !== "string") return null;

  return { slug, title, summary, imageUrl, publishedOn };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
