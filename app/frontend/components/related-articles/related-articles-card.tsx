import { HiOutlineDocumentText, HiOutlineTag } from "react-icons/hi2";
import { Link } from "react-router";
import { toDisplayDate } from "~/frontend/lib/display-date";

export interface RelatedArticleItem {
  readonly slug: string;
  readonly title: string;
  readonly imageUrl: string | null;
  readonly publishedOn: string;
  /** 題の言語 (BCP 47)。記事の DTO の `language` を渡す。 */
  readonly language: string;
}

interface RelatedArticlesCardProps {
  /** 区画の名前 ("Related articles"。見える名前は訳さない)。 */
  readonly title: string;
  readonly articles: readonly RelatedArticleItem[];
}

/**
 * 記事ページの右の列、目次の下に置く関連記事のカード。
 *
 * 本文の末尾の分かれ道 (ArticleBranches) と同じ記事を、読んでいる最中にも目に入る場所に
 * 出す。右の列は広い画面にしか無いので、狭い画面では末尾の分かれ道だけが出る
 * (どちらを出すかは routes/articles.$slug.tsx が決める)。
 *
 * 要約は出さない。列が狭く、題と日付と絵で足りる。
 */
export function RelatedArticlesCard({
  title,
  articles,
}: RelatedArticlesCardProps): React.JSX.Element | null {
  if (articles.length === 0) return null;

  return (
    <section aria-label={title} className="related-card">
      <h2 className="related-card-heading">
        <HiOutlineTag aria-hidden />
        {title}
      </h2>
      <ul className="related-card-list">
        {articles.map((article) => (
          <li key={article.slug}>
            <Link to={`/articles/${article.slug}`} className="related-card-link press-surface">
              {/*
                絵は飾りで、名前は右の題が持つ (alt は空)。カバー画像の無い記事は、
                紙の絵の札に倒す (枠の大きさを揃えて、題の頭の位置がずれないように)。
              */}
              {article.imageUrl === null ? (
                <span className="related-card-thumb related-card-thumb-empty" aria-hidden="true">
                  <HiOutlineDocumentText />
                </span>
              ) : (
                <img
                  className="related-card-thumb"
                  src={article.imageUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
              )}
              <span className="related-card-body">
                <span lang={article.language} className="related-card-title">
                  {article.title}
                </span>
                <time dateTime={article.publishedOn} className="related-card-date">
                  {toDisplayDate(article.publishedOn)}
                </time>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
