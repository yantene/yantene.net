import type { TocHeading } from "~/backend/handlers/articles/toc-headings";

/** h2 と、その配下に並ぶ h3。 */
export interface TocSection {
  readonly heading: TocHeading;
  readonly children: readonly TocHeading[];
}

/**
 * フラットな見出し列を h2 セクション (+ 配下 h3) にまとめる。
 *
 * h3 は直前のセクション配下に入る。h2 と、セクションがまだ開いていないときの h3 は
 * 新しいセクションを開く (h3 から書き始めた記事でも見出しが落ちないように)。
 */
export function toSections(headings: readonly TocHeading[]): readonly TocSection[] {
  const sections: { heading: TocHeading; children: TocHeading[] }[] = [];
  for (const heading of headings) {
    const last = sections.at(-1);
    if (heading.level === 3 && last !== undefined) {
      last.children.push(heading);
    } else {
      sections.push({ heading, children: [] });
    }
  }
  return sections;
}

/**
 * いま読んでいる見出しが属するセクションを返す。
 *
 * h3 を読んでいるときに返るのは、その h3 ではなく、抱えている h2。節の名前として出したい
 * のは章の名前であって、章の中の小見出しではない。
 */
export function sectionOf(
  sections: readonly TocSection[],
  activeId: string,
): TocSection | undefined {
  if (activeId === "") return undefined;
  return sections.find(
    (section) =>
      section.heading.id === activeId || section.children.some((child) => child.id === activeId),
  );
}
