import {
  NoteTimelineItem,
  type NoteTimelineItemProps,
} from "./note-timeline-item";

interface NoteTimelineProps {
  readonly notes: readonly NoteTimelineItemProps[];
}

/**
 * 記事を時系列に並べる縦のタイムライン (トップページの新着)。
 *
 * ノート一覧・検索・タグの各ページは引き続きカード (NoteCard) を使う。トップだけが
 * ヒーローの時刻軸と地続きの見せ方をしていて、他のページには合わないため。
 */
export function NoteTimeline({ notes }: NoteTimelineProps): React.JSX.Element {
  return (
    <ol className="note-timeline">
      {notes.map((note) => (
        <NoteTimelineItem key={note.slug} {...note} />
      ))}
    </ol>
  );
}
