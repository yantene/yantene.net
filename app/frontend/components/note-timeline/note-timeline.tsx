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
  /**
   * 先頭に順位を出すか。人気順のように、並び自体が意味を持つ一覧で使う。
   * 公開月のドットは順位に置き換わる (時系列ではないので月の色に意味がない)。
   */
  readonly ranked?: boolean;
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
  ranked = false,
}: NoteTimelineProps): React.JSX.Element {
  if (!groupByYear) {
    return (
      <ol className="note-timeline note-timeline-list note-timeline-flat h-feed">
        {notes.map((note, index) => (
          <NoteTimelineItem
            key={note.slug}
            {...note}
            rank={ranked ? index + 1 : undefined}
          />
        ))}
      </ol>
    );
  }

  return (
    /*
      年で束ねるときは h-feed を外側に置く。年ごとの ol に付けると、1 ページに
      いくつも feed があることになり、どれが記事の並びなのか読み取れなくなる。
    */
    <div className="note-timeline h-feed">
      {groupByPublishedYear(notes).map((group) => (
        // 年は見出しにしない。置かれる場所によって適切な見出しレベルが変わるうえ、
        // 日付は各項目の time 要素が持っているので、読み上げに年の見出しは要らない。
        <div key={group.year} className="note-timeline-group">
          <p className="note-timeline-year">{group.year}</p>
          <ol className="note-timeline-list">
            {group.notes.map((note) => (
              // 年は左に立っているので、日付からは落とす。
              <NoteTimelineItem key={note.slug} {...note} omitYear />
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
