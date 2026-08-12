import { Link } from "react-router";

export interface NoteBranchItem {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly publishedOn: string;
}

interface NoteBranchesProps {
  readonly notes: readonly NoteBranchItem[];
}

/**
 * 本文の末尾から枝分かれする、関連ノートへの分かれ道。
 *
 * 一覧と同じ形 (時間軸に並ぶノード) では「続きの一覧」に見えてしまい、ここが別の道へ
 * 逸れる場所だと伝わらない。読み終えた本文から線を垂らし、そこから枝を出す形にする。
 *
 * 関連度で並ぶ場所なので日付は添えるだけに留め、順位も番号も出さない。
 */
export function NoteBranches({ notes }: NoteBranchesProps): React.JSX.Element {
  return (
    <ul className="note-branches">
      {notes.map((note) => (
        <li key={note.slug} className="note-branch">
          {/* 一覧の項目と同じく行全体が押し場所なので、押下の反応も同じ press-surface。 */}
          <Link
            to={`/notes/${note.slug}`}
            className="note-branch-link press-surface group"
          >
            <span className="note-branch-body">
              <span className="note-branch-title">{note.title}</span>
              <span className="note-branch-summary">{note.summary}</span>
            </span>
            <time dateTime={note.publishedOn} className="note-branch-date">
              {note.publishedOn}
            </time>
          </Link>
        </li>
      ))}
    </ul>
  );
}
