import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { parseNoteListPayload } from "./note-list-payload";
import { NoteTimeline } from "./note-timeline";
import type { NoteListPayload } from "./note-list-payload";
import type { NoteTimelineItemProps } from "./note-timeline-item";

/** 続きを取ってくる手。取れなければ投げる。 */
export type LoadNotePage = (
  page: number,
  perPage: number,
) => Promise<NoteListPayload>;

interface InfiniteNoteTimelineProps {
  /** SSR で描いた 1 ページ目。JS が動かない環境ではこれだけが残る。 */
  readonly initialNotes: readonly NoteTimelineItemProps[];
  readonly totalPages: number;
  readonly perPage: number;
  /**
   * 続きの取り方。既定は公開 API を叩く。
   * 差し替え口を開けてあるのは、サーバーのない場所でも様子を確かめられるようにするため。
   */
  readonly loadPage?: LoadNotePage;
  /** 年の区切りを差し込むか (NoteTimeline にそのまま渡す)。 */
  readonly groupByYear?: boolean;
}

/** 既定の取り方。公開 API から 1 ページぶんを読む。 */
const fetchNotePage: LoadNotePage = async (page, perPage) => {
  const url = `/api/v1/notes?page=${String(page)}&per-page=${String(perPage)}`;
  const response = await fetch(url, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`status ${String(response.status)}`);

  const payload = parseNoteListPayload(await response.json());
  if (payload === null) throw new Error("unexpected payload");
  return payload;
};

/** 続きを取りに行くのは、下端がこれだけ近づいたとき。 */
const PREFETCH_MARGIN = "320px";

/**
 * 下端に近づくたびに続きを足していくタイムライン。
 *
 * 1 ページ目はサーバーが描き、以降はブラウザが `/api/v1/notes` から取る。JS が動かない
 * 環境では 1 ページ目のまま止まるが、一覧ページへのリンクが隣にあるので行き止まりにはならない。
 */
export function InfiniteNoteTimeline({
  initialNotes,
  totalPages,
  perPage,
  loadPage = fetchNotePage,
  groupByYear = false,
}: InfiniteNoteTimelineProps): React.JSX.Element {
  const { t } = useTranslation();
  const [notes, setNotes] = useState(initialNotes);
  const [page, setPage] = useState(1);
  const [state, setState] = useState<"idle" | "loading" | "failed">("idle");

  /*
   * 別の 1 ページ目が来たら、積んだものを捨てて出し直す。
   *
   * useState が見るのは初回の値だけなので、これが無いと絞り込みや検索語を変えても
   * 表示が前のまま残る (見出しだけが変わって、並んでいる記事が変わらない)。
   * 描画中に state を書き換えるのは、この場で作り直すための React の作法。
   */
  const [shownFirstPage, setShownFirstPage] = useState(initialNotes);
  if (shownFirstPage !== initialNotes) {
    setShownFirstPage(initialNotes);
    setNotes(initialNotes);
    setPage(1);
    setState("idle");
  }
  const sentinelRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const hasMore = page < totalPages;

  const loadMore = useCallback(async (): Promise<void> => {
    // 見張りは短い間に何度も反応しうる。state の反映を待たずに二重で取りに行かない。
    if (busyRef.current) return;
    busyRef.current = true;

    const next = page + 1;
    setState("loading");
    try {
      const payload = await loadPage(next, perPage);
      setNotes((current) => [...current, ...payload.notes]);
      setPage(next);
      setState("idle");
    } catch {
      // 黙って止まると「続きがない」と区別がつかないので、失敗として見せる。
      setState("failed");
    } finally {
      busyRef.current = false;
    }
  }, [page, perPage, loadPage]);

  useEffect(() => {
    // 失敗したあとは、押されるまで自動では取りに行かない (同じ失敗を繰り返さないため)。
    if (!hasMore || state !== "idle") return;

    const sentinel = sentinelRef.current;
    if (sentinel === null) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore();
      },
      { rootMargin: PREFETCH_MARGIN },
    );
    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [hasMore, state, loadMore]);

  return (
    <>
      <NoteTimeline notes={notes} groupByYear={groupByYear} />

      {/* 下端の見張り。ここが視界に入ったら続きを取りに行く。 */}
      {hasMore && state !== "failed" && (
        <div ref={sentinelRef} aria-hidden="true" className="h-px" />
      )}

      {/*
        読み込みの様子は文字でも伝える。スクロールだけで内容が増えることに気づけない
        読み方 (読み上げなど) があるため。
      */}
      <p
        aria-live="polite"
        className="py-6 text-center text-sm text-base-content/60"
      >
        {state === "loading" && t("timeline.loadingMore")}
        {state === "failed" && (
          <>
            {t("timeline.loadMoreFailed")}{" "}
            <button
              type="button"
              onClick={() => {
                void loadMore();
              }}
              className="link link-primary press-control"
            >
              {t("timeline.retry")}
            </button>
          </>
        )}
        {state === "idle" &&
          !hasMore &&
          notes.length > 0 &&
          t("timeline.allLoaded")}
      </p>
    </>
  );
}
