import { Link } from "react-router";

export interface PopularNoteItemProps {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly tags: readonly string[];
  readonly publishedOn: string;
}

interface PopularNotesProps {
  readonly notes: readonly PopularNoteItemProps[];
}

/** 添えるタグの数。多いと日付と競って読みづらくなる。 */
const SHOWN_TAG_COUNT = 2;

/**
 * よく読まれている記事の列。
 *
 * 初めて来た人が知りたいのは「何が面白いのか」で、時系列の羅列ではない。そのため
 * 最近の記事と同じだけの情報 (表題・要約・日付) を持たせ、順位を大きく添える。
 * 脇に小さく置くと、押す理由のないリンクの列にしかならない。
 */
export function PopularNotes({ notes }: PopularNotesProps): React.JSX.Element {
  return (
    <ol className="popular-notes">
      {notes.map((note, index) => (
        <li key={note.slug} className="popular-notes-item">
          <Link to={`/notes/${note.slug}`} className="popular-notes-link group">
            {/* 順位は装飾。読み上げには表題と日付があれば足りる。 */}
            <span className="popular-notes-rank" aria-hidden="true">
              {index + 1}
            </span>

            <div className="popular-notes-body">
              <h3 className="popular-notes-title">{note.title}</h3>
              <p className="popular-notes-summary">{note.summary}</p>
              <p className="popular-notes-meta">
                <time dateTime={note.publishedOn}>{note.publishedOn}</time>
                {note.tags.slice(0, SHOWN_TAG_COUNT).map((tag) => (
                  <span key={tag} className="popular-notes-tag">
                    {tag}
                  </span>
                ))}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ol>
  );
}
