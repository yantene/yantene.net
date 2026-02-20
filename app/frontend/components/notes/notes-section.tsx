import { useCallback, useEffect, useRef, useState } from "react";
import { NoteCard } from "./note-card";
import type { NoteListItem, NotesListResponse } from "~/lib/types/notes";

type NotesSectionProps = {
  readonly initialNotes: readonly NoteListItem[];
  readonly initialTotalPages: number;
};

const PER_PAGE = 12;

export function NotesSection({
  initialNotes,
  initialTotalPages,
}: NotesSectionProps): React.JSX.Element {
  const [notes, setNotes] = useState<readonly NoteListItem[]>(initialNotes);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialTotalPages > 1);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchNextPage = useCallback(async (): Promise<void> => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    const nextPage = currentPage + 1;

    try {
      const response = await fetch(
        `/api/v1/notes?page=${String(nextPage)}&per-page=${String(PER_PAGE)}`,
      );
      const data: NotesListResponse = await response.json();

      setNotes((prev) => [...prev, ...data.notes]);
      setCurrentPage(nextPage);
      setHasMore(nextPage < data.pagination.totalPages);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, isLoading, hasMore]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          void fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(el);
    return (): void => {
      observer.disconnect();
    };
  }, [fetchNextPage]);

  if (notes.length === 0) {
    return (
      <section className="mx-auto max-w-5xl px-6 py-16">
        <p className="text-center text-muted-foreground">
          まだ記事がありません。
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl px-6 py-12">
      <h2 className="mb-8 text-2xl font-bold tracking-tight">
        <span className="text-primary">N</span>otes
      </h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {notes.map((note) => (
          <NoteCard key={note.id} note={note} />
        ))}
      </div>
      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-8">
          {isLoading && (
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          )}
        </div>
      )}
    </section>
  );
}
