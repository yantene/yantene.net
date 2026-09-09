import { Link } from "react-router";

export interface ArticleBranchItem {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly publishedOn: string;
}

interface ArticleBranchesProps {
  readonly articles: readonly ArticleBranchItem[];
}

/**
 * 本文の末尾から枝分かれする、関連記事への分かれ道。
 *
 * 一覧と同じ形 (時間軸に並ぶノード) では「続きの一覧」に見えてしまい、ここが別の道へ
 * 逸れる場所だと伝わらない。読み終えた本文から線を垂らし、そこから枝を出す形にする。
 *
 * 関連度で並ぶ場所なので日付は添えるだけに留め、順位も番号も出さない。
 */
export function ArticleBranches({ articles }: ArticleBranchesProps): React.JSX.Element {
  return (
    <ul className="article-branches">
      {articles.map((article) => (
        <li key={article.slug} className="article-branch">
          {/* 一覧の項目と同じく行全体が押し場所なので、押下の反応も同じ press-surface。 */}
          <Link
            to={`/articles/${article.slug}`}
            className="article-branch-link press-surface group"
          >
            <span className="article-branch-body">
              <span className="article-branch-title">{article.title}</span>
              <span className="article-branch-summary">{article.summary}</span>
            </span>
            <time dateTime={article.publishedOn} className="article-branch-date">
              {article.publishedOn}
            </time>
          </Link>
        </li>
      ))}
    </ul>
  );
}
