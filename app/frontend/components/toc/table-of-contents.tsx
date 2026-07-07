import { useEffect, useState } from "react";

export interface TocHeading {
  readonly id: string;
  readonly text: string;
  readonly level: 2 | 3;
}

interface Section {
  readonly heading: TocHeading;
  readonly children: readonly TocHeading[];
}

/** これ未満の見出し数なら目次を出さない。 */
const MIN_HEADINGS = 2;

/** フラットな見出し列を h2 セクション (+ 配下 h3) にまとめる。 */
function toSections(headings: readonly TocHeading[]): readonly Section[] {
  const sections: { heading: TocHeading; children: TocHeading[] }[] = [];
  for (const heading of headings) {
    const last = sections.at(-1);
    // h3 は直前のセクション配下に。h2 (または先頭の h3) は新しいセクションを開く。
    if (heading.level === 3 && last !== undefined) {
      last.children.push(heading);
    } else {
      sections.push({ heading, children: [] });
    }
  }
  return sections;
}

/**
 * scroll-spy: 本文の見出し要素を IntersectionObserver で監視し、ビューポート上部に
 * 到達している最初の見出しを active にする。何も交差していないときは直前の値を保つ。
 */
function useActiveHeading(headings: readonly TocHeading[]): string {
  const [activeId, setActiveId] = useState("");
  useEffect(() => {
    if (headings.length === 0) return;
    const elements = [
      ...document.querySelectorAll<HTMLElement>(
        ".note-prose h2, .note-prose h3",
      ),
    ].filter((element) => element.id.length > 0);
    if (elements.length === 0) return;

    const visibility = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visibility.set(entry.target.id, entry.isIntersecting);
        }
        const firstVisible = headings.find(
          (heading) => visibility.get(heading.id) === true,
        );
        if (firstVisible !== undefined) setActiveId(firstVisible.id);
      },
      // ビューポート上部 20% のバンドに入った見出しを「現在地」とみなす。
      { rootMargin: "0px 0px -80% 0px" },
    );
    for (const element of elements) observer.observe(element);
    return () => observer.disconnect();
  }, [headings]);
  return activeId;
}

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
              <a
                href={`#${section.heading.id}`}
                className={`-ml-px block border-l-2 py-1 pl-4 transition-colors ${
                  section.heading.id === activeId
                    ? "border-primary font-medium text-primary"
                    : "border-transparent text-base-content/60 hover:text-base-content"
                }`}
              >
                {section.heading.text}
              </a>
              {isActiveSection && section.children.length > 0 && (
                <ul>
                  {section.children.map((child) => (
                    <li key={child.id}>
                      <a
                        href={`#${child.id}`}
                        className={`-ml-px block border-l-2 py-0.5 pl-8 text-xs transition-colors ${
                          child.id === activeId
                            ? "border-primary font-medium text-primary"
                            : "border-transparent text-base-content/50 hover:text-base-content"
                        }`}
                      >
                        {child.text}
                      </a>
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
