import { Link } from "react-router";
import { toSections } from "./sections";
import { useActiveHeading } from "./use-active-heading";
import type { TocHeading } from "~/backend/handlers/articles/toc-headings";

export type { TocHeading };

/** これ未満の見出し数なら目次を出さない。 */
const MIN_HEADINGS = 2;

interface TableOfContentsProps {
  /** 見出しラベル ("目次" 等・i18n で外から渡す)。 */
  readonly title: string;
  /** サーバー側で抽出した見出し (rehype-slug と一致する id 付き)。 */
  readonly headings: readonly TocHeading[];
}

/**
 * 記事内の目次。右カラムに sticky で置く前提。scroll-spy で現在位置を強調し、
 * h3 はアクティブな h2 セクション配下のみ展開する。見出しが少なければ描画しない。
 */
export function TableOfContents({
  title,
  headings,
}: TableOfContentsProps): React.JSX.Element | null {
  const activeId = useActiveHeading(headings);

  if (headings.length < MIN_HEADINGS) return null;

  const sections = toSections(headings);
  return (
    <nav aria-label={title} className="text-sm">
      <p className="mb-3 font-bold text-base-content/70">{title}</p>
      <ul className="border-l border-base-300">
        {sections.map((section) => {
          const isActiveSection =
            section.heading.id === activeId ||
            section.children.some((child) => child.id === activeId);
          return (
            <li key={section.heading.id}>
              {/*
                素の <a href="#..."> だと ScrollRestoration がブラウザのハッシュ
                ジャンプを打ち消してスクロールしない。Link で React Router に
                ハッシュ遷移として扱わせる。
              */}
              <Link
                to={`#${section.heading.id}`}
                className={`press-control -ml-px block border-l-2 py-1 pl-4 transition-colors ${
                  section.heading.id === activeId
                    ? "border-primary font-medium text-primary"
                    : "border-transparent text-base-content/60 hover:text-base-content"
                }`}
              >
                {section.heading.text}
              </Link>
              {isActiveSection && section.children.length > 0 && (
                <ul>
                  {section.children.map((child) => (
                    <li key={child.id}>
                      <Link
                        to={`#${child.id}`}
                        className={`press-control -ml-px block border-l-2 py-0.5 pl-8 text-xs transition-colors ${
                          child.id === activeId
                            ? "border-primary font-medium text-primary"
                            : "border-transparent text-base-content/50 hover:text-base-content"
                        }`}
                      >
                        {child.text}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
