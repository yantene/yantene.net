import { Link } from "react-router";
import type { NoteTimelineItemProps } from "./note-timeline-item";

interface PopularNotesProps {
  readonly notes: readonly NoteTimelineItemProps[];
}

/**
 * よく読まれている記事を順位付きで並べる、脇に添える短い列。
 *
 * 時系列ではないので線もドットも引かない。番号だけが並ぶ形にしているのは、隣の
 * タイムラインと見た目が競らないようにするため。番号は駅番号のつもりで、順位の
 * 上下より「印がついている」ことを伝える。
 */
export function PopularNotes({ notes }: PopularNotesProps): React.JSX.Element {
  return (
    <ol className="popular-notes">
      {notes.map((note, index) => (
        <li key={note.slug} className="popular-notes-item">
          <Link to={`/notes/${note.slug}`} className="popular-notes-link group">
            <span className="popular-notes-rank" aria-hidden="true">
              {index + 1}
            </span>
            <span className="popular-notes-title">{note.title}</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
