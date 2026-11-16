import type { ArticlePreview } from "~/backend/handlers/articles/preview.handler";
import { toDisplayDate } from "~/frontend/lib/display-date";

export interface ArticlePreviewCardProps {
  readonly preview: ArticlePreview;
}

/**
 * 内部リンクのチップの中身。リンク先が「いつの、何の記事か」を伝える。
 *
 * **カバー画像は描かない。** 載せると重くなり、絵の有無でチップの大きさが変わる。
 *
 * microformats の印 (`h-entry` や `p-name`) は付けない。ここにあるのは別の記事の
 * 予告で、いま開いている記事の一部ではない。
 */
export function ArticlePreviewCard({ preview }: ArticlePreviewCardProps): React.JSX.Element {
  return (
    <div className="article-preview-card">
      <time className="article-preview-date" dateTime={preview.publishedOn}>
        {toDisplayDate(preview.publishedOn)}
      </time>
      <p className="article-preview-title">{preview.title}</p>
      {preview.summary !== "" && <p className="article-preview-summary">{preview.summary}</p>}
    </div>
  );
}
