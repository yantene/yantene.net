import { Link } from "@inertiajs/react";
import { useTranslation } from "react-i18next";
import { buildPageItems } from "./build-page-items";

export interface PaginationProps {
  /** 現在のページ (1 始まり)。 */
  readonly page: number;
  /** 総ページ数。 */
  readonly totalPages: number;
  /** ページ番号から遷移先 URL を組み立てる。 */
  readonly hrefForPage: (page: number) => string;
}

/** ページネーション UI。総ページ数が 1 以下のときは何も描画しない。 */
export function Pagination({
  page,
  totalPages,
  hrefForPage,
}: PaginationProps): React.JSX.Element | null {
  const { t } = useTranslation();
  if (totalPages <= 1) return null;

  const items = buildPageItems(page, totalPages);
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <nav className="join" aria-label={t("notes.pagination.label")}>
      {hasPrev ? (
        <Link
          href={hrefForPage(page - 1)}
          rel="prev"
          className="join-item btn"
          aria-label={t("notes.pagination.previous")}
        >
          «
        </Link>
      ) : (
        <span className="join-item btn btn-disabled" aria-hidden="true">
          «
        </span>
      )}

      {items.map((item) =>
        item.type === "ellipsis" ? (
          <span
            key={`ellipsis-after-${String(item.after)}`}
            className="join-item btn btn-disabled"
            aria-hidden="true"
          >
            …
          </span>
        ) : (
          <Link
            key={item.page}
            href={hrefForPage(item.page)}
            className={`join-item btn${item.page === page ? " btn-active" : ""}`}
            aria-current={item.page === page ? "page" : undefined}
          >
            {item.page}
          </Link>
        ),
      )}

      {hasNext ? (
        <Link
          href={hrefForPage(page + 1)}
          rel="next"
          className="join-item btn"
          aria-label={t("notes.pagination.next")}
        >
          »
        </Link>
      ) : (
        <span className="join-item btn btn-disabled" aria-hidden="true">
          »
        </span>
      )}
    </nav>
  );
}
