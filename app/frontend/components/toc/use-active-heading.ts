import { useEffect, useState } from "react";
import type { TocHeading } from "~/backend/handlers/articles/toc-headings";

/** 現在地とみなすビューポート上部の帯。ここに入った見出しを「いま読んでいる」とする。 */
const TOP_BAND = "0px 0px -80% 0px";

/**
 * 本文の見出しを見張り、いまビューポート上部の帯に届いている最初の見出しの id を返す。
 *
 * 何も帯に入っていないときは直前の値を保つ。節の中ほどを読んでいる間は見出しが画面の外に
 * あるので、そこで空に戻すと現在地が点滅する。
 *
 * 右カラムの目次 (table-of-contents.tsx) と、上端の節名バー (current-section) が共有する。
 * 2 つが別々に見張ると、同じ画面で違う見出しを現在地と呼びうる。
 */
export function useActiveHeading(headings: readonly TocHeading[]): string {
  const [activeId, setActiveId] = useState("");

  /*
   * 記事を移ったら現在地を捨てる。持ち越すと、次の記事に同じ綴りの見出し (「はじめに」
   * などは重なりやすい) があったときに、読み始める前からそこが光る。
   *
   * 捨てるのは描画中で、effect の中ではない (use-entered-body.ts と同じ理由)。
   */
  const [watched, setWatched] = useState(headings);
  if (watched !== headings) {
    setWatched(headings);
    setActiveId("");
  }

  useEffect(() => {
    if (headings.length === 0) return;
    const elements = [
      ...document.querySelectorAll<HTMLElement>(".mdast-prose h2, .mdast-prose h3"),
    ].filter((element) => element.id.length > 0);
    if (elements.length === 0) return;

    const visibility = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visibility.set(entry.target.id, entry.isIntersecting);
        }
        const firstVisible = headings.find((heading) => visibility.get(heading.id) === true);
        if (firstVisible !== undefined) setActiveId(firstVisible.id);
      },
      { rootMargin: TOP_BAND },
    );
    for (const element of elements) observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [headings]);

  return activeId;
}
