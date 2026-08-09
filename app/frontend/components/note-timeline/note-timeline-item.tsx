import { HiArrowRight } from "react-icons/hi2";
import { Link } from "react-router";
import { seasonDotClass } from "./season-color";

export interface NoteTimelineItemProps {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly imageUrl: string | null;
  readonly publishedOn: string;
}

interface NoteTimelineItemOptions {
  /**
   * 日付から年を落とすか。年を別に立てている一覧で使う。
   * 落とすのは見た目だけで、time 要素には完全な日付が残る。
   */
  readonly omitYear?: boolean;
}

/**
 * タイムライン 1 件分。項目全体がノート詳細へのリンクになる。
 *
 * 左端のドットは公開月を 1 年の位相として表す装飾で、意味を担っていないため
 * 読み上げからは外している (日付は隣の time 要素が持つ)。
 */
export function NoteTimelineItem({
  slug,
  title,
  summary,
  imageUrl,
  publishedOn,
  omitYear = false,
}: NoteTimelineItemProps & NoteTimelineItemOptions): React.JSX.Element {
  // "2016-09-26" から年を落として "09-26" にする。
  const shownDate = omitYear ? publishedOn.slice(5) : publishedOn;
  return (
    <li className="note-timeline-item">
      <Link
        to={`/notes/${slug}`}
        className="note-timeline-link group border-b border-border/60 transition-colors hover:bg-base-200/40"
      >
        <span
          className={`note-timeline-dot ${seasonDotClass(publishedOn)}`}
          aria-hidden="true"
        />

        <time
          dateTime={publishedOn}
          className="note-timeline-date pt-1 text-sm tabular-nums text-base-content/60 sm:pt-0"
        >
          {shownDate}
        </time>

        <div className="note-timeline-body flex flex-col gap-1">
          <h3 className="font-bold leading-snug transition-colors group-hover:text-primary">
            {title}
          </h3>
          <p className="line-clamp-2 text-sm text-base-content/70">{summary}</p>
        </div>

        {imageUrl !== null && (
          <figure className="note-timeline-thumb overflow-hidden rounded-lg border border-border/60">
            {/*
              寸法を属性で与えて読み込み前から場所を確保する (レイアウトシフト対策)。
              実寸ではなく比率を伝えるための値で、表示サイズは CSS 側が決める。
            */}
            <img
              src={imageUrl}
              alt=""
              width={320}
              height={200}
              loading="lazy"
              decoding="async"
              className="h-14 w-20 object-cover sm:h-20 sm:w-32"
            />
          </figure>
        )}

        <span
          className="note-timeline-arrow text-lg text-base-content/40 transition-colors group-hover:text-primary"
          aria-hidden="true"
        >
          <HiArrowRight />
        </span>
      </Link>
    </li>
  );
}
