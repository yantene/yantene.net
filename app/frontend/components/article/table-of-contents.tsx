import { useCallback, useEffect, useState } from "react";
import type { TocEntry } from "./heading-utils";

type TableOfContentsProps = {
  readonly entries: readonly TocEntry[];
};

const indent: Record<number, string> = {
  2: "",
  3: "pl-4",
  4: "pl-8",
};

function useActiveHeading(ids: readonly string[]): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);

  const handleIntersect = useCallback(
    (observerEntries: IntersectionObserverEntry[]) => {
      const visible = observerEntries.filter((entry) => entry.isIntersecting);
      if (visible.length === 0) return;

      let topEntry = visible[0];
      for (const entry of visible) {
        if (entry.boundingClientRect.top < topEntry.boundingClientRect.top) {
          topEntry = entry;
        }
      }
      setActiveId(topEntry.target.id);
    },
    [],
  );

  useEffect(() => {
    const observer = new IntersectionObserver(handleIntersect, {
      rootMargin: "-80px 0px -60% 0px",
      threshold: 0,
    });

    for (const id of ids) {
      if (!id) continue;
      const el = document.querySelector(`#${CSS.escape(id)}`);
      if (el !== null) observer.observe(el);
    }

    return (): void => {
      observer.disconnect();
    };
  }, [ids, handleIntersect]);

  return activeId;
}

export function TableOfContents({
  entries,
}: TableOfContentsProps): React.JSX.Element {
  const ids = entries.map((e) => e.id);
  const activeId = useActiveHeading(ids);

  return (
    <nav aria-label="目次" className="text-sm">
      <h2 className="mb-3 font-semibold text-foreground">目次</h2>
      <ul className="space-y-1">
        {entries.map((entry) => {
          const isActive = entry.id === activeId;
          return (
            <li key={entry.id} className={indent[entry.depth] ?? ""}>
              <a
                href={`#${entry.id}`}
                className={`block rounded-sm px-2 py-1 transition-colors ${
                  isActive
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {entry.number !== "" && (
                  <span className="text-muted-foreground">{entry.number} </span>
                )}
                {entry.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
