import {
  NoteTimelineItem,
  type NoteTimelineItemProps,
} from "./note-timeline-item";

interface NoteTimelineProps {
  readonly notes: readonly NoteTimelineItemProps[];
  /**
   * 年の区切りを差し込むか。
   *
   * 時系列に並んだ一覧でだけ意味を持つ。関連度順・連載順の並びに年を差すと、
   * 同じ年が何度も現れて時間軸に見えなくなるため既定では付けない。
   */
  readonly groupByYear?: boolean;
}

interface YearGroup {
  readonly year: string;
  readonly notes: readonly NoteTimelineItemProps[];
}

/**
 * 並び順を保ったまま、公開年で束ね直す。
 *
 * 記事のない年は現れない。線に欠番の駅を作らないため、年は等間隔には並ばず、
 * 束の大きさ (＝その年に書いた量) がそのまま線の長さになる。
 */
function groupByPublishedYear(
  notes: readonly NoteTimelineItemProps[],
): readonly YearGroup[] {
  const yearOf = (note: NoteTimelineItemProps): string =>
    note.publishedOn.slice(0, 4);
  // Set は現れた順を保つので、年の並びは元の並び順のままになる。
  const years = [...new Set(notes.map((note) => yearOf(note)))];
  return years.map((year) => ({
    year,
    notes: notes.filter((note) => yearOf(note) === year),
  }));
}

/**
 * 記事を時系列に並べる縦のタイムライン。
 *
 * トップの新着、ノート一覧、検索結果、シリーズがこれを共有する。カード表示は
 * サムネイルのある記事を前提にした器で、実際には持たない記事が大半のため使わない。
 */
export function NoteTimeline({
  notes,
  groupByYear = false,
}: NoteTimelineProps): React.JSX.Element {
  if (!groupByYear) {
    return (
      <ol className="note-timeline note-timeline-list note-timeline-flat">
        {notes.map((note) => (
          <NoteTimelineItem key={note.slug} {...note} />
        ))}
      </ol>
    );
  }

  return (
    <div className="note-timeline">
      {groupByPublishedYear(notes).map((group) => (
        <section key={group.year} className="note-timeline-group">
          <h2 className="note-timeline-year">{group.year}</h2>
          <ol className="note-timeline-list">
            {group.notes.map((note) => (
              // 年は左に立っているので、日付からは落とす。
              <NoteTimelineItem key={note.slug} {...note} omitYear />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
