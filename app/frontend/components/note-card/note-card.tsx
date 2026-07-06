import { Link } from "@inertiajs/react";

export interface NoteCardProps {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly imageUrl: string | null;
  readonly tags: readonly string[];
  readonly publishedOn: string;
}

/**
 * ノート一覧・ホーム新着で使い回す縦型カード。カード全体がノート詳細へのリンク。
 * カード内はリンクを入れ子にできないため、タグは表示のみ (絞り込みは詳細ページで)。
 */
export function NoteCard({
  slug,
  title,
  summary,
  imageUrl,
  tags,
  publishedOn,
}: NoteCardProps): React.JSX.Element {
  return (
    <Link
      href={`/notes/${slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-base-300 bg-base-100 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
    >
      <figure className="aspect-video overflow-hidden">
        {imageUrl === null ? (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 to-secondary/15">
            <span className="text-4xl font-bold text-primary/40">
              {title.charAt(0) || "?"}
            </span>
          </div>
        ) : (
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        )}
      </figure>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <time dateTime={publishedOn} className="text-xs text-base-content/60">
          {publishedOn}
        </time>
        <h3 className="line-clamp-2 font-bold leading-snug transition-colors group-hover:text-primary">
          {title}
        </h3>
        <p className="line-clamp-2 flex-1 text-sm text-base-content/70">
          {summary}
        </p>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span key={tag} className="badge badge-sm badge-ghost">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
