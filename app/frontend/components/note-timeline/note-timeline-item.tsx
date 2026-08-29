import { HiArrowRight } from "react-icons/hi2";
import { Link } from "react-router";
import { seasonDotClass } from "./season-color";

export interface NoteTimelineItemProps {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly imageUrl: string | null;
  readonly tags: readonly string[];
  readonly publishedOn: string;
}

interface NoteTimelineItemOptions {
  /**
   * 日付から年を落とすか。年を別に立てている一覧で使う。
   * 落とすのは見た目だけで、time 要素には完全な日付が残る。
   */
  readonly omitYear?: boolean;
  /**
   * 先頭に出す順位。人気順のように時系列でない並びで使う。
   * 与えると、公開月を表すドットの代わりにこの数字が印になる。
   */
  readonly rank?: number;
}

/** 添えるタグの数。多いと日付と競って読みづらくなる。 */
const SHOWN_TAG_COUNT = 3;

/**
 * タイムライン 1 件分。項目全体がノート詳細へのリンクになる。
 *
 * 最近の記事も人気の記事もこれを使う。並びの意味が違っても項目の作りが変わると、
 * 同じ一覧なのに情報の在り処が食い違って読みにくくなるため。違いは先頭の印だけで、
 * 時系列なら公開月を表すドット、順位付きなら番号を出す。
 */
export function NoteTimelineItem({
  slug,
  title,
  summary,
  imageUrl,
  tags,
  publishedOn,
  omitYear = false,
  rank,
}: NoteTimelineItemProps & NoteTimelineItemOptions): React.JSX.Element {
  // "2016-09-26" から年を落として "09-26" にする。
  const shownDate = omitYear ? publishedOn.slice(5) : publishedOn;

  return (
    <li className="note-timeline-item h-entry">
      {/* 行そのものが押し場所なので、押下の反応は面を塗る press-surface で受ける。 */}
      <Link
        to={`/notes/${slug}`}
        className="note-timeline-link press-surface group border-b border-border/60 transition-colors hover:bg-base-200/40 u-url"
      >
        {rank === undefined ? (
          // ドットは公開月を 1 年の位相として表す装飾で、意味を担っていないため
          // 読み上げからは外す (日付は隣の time 要素が持つ)。
          <span className={`note-timeline-dot ${seasonDotClass(publishedOn)}`} aria-hidden="true" />
        ) : (
          <span className="note-timeline-rank" aria-hidden="true">
            {rank}
          </span>
        )}

        <time
          dateTime={publishedOn}
          className="note-timeline-date dt-published pt-1 text-sm tabular-nums text-base-content/60 sm:pt-0"
        >
          {shownDate}
        </time>

        <div className="note-timeline-body flex flex-col gap-1">
          <h3 className="p-name font-bold leading-snug transition-colors group-hover:text-primary">
            {title}
          </h3>
          <p className="p-summary line-clamp-2 text-sm text-base-content/70">{summary}</p>
          {tags.length > 0 && (
            <p className="note-timeline-tags">
              {tags.slice(0, SHOWN_TAG_COUNT).map((tag) => (
                <span key={tag} className="note-timeline-tag p-category">
                  {tag}
                </span>
              ))}
            </p>
          )}
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
