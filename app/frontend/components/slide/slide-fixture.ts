import type { SlideContext } from "./slide-page";
import { parseMarkdownBody } from "~/backend/services/markdown-body";
import { paginate } from "~/lib/slides/deck";
import { SAMPLE_SLIDE_MARKDOWN } from "~/lib/slides/sample-deck";

/*
 * 見本のデッキを、描ける形にしたもの。stories とテストが同じものを使う。
 * 原文は `app/lib/slides/sample-deck.ts` (意味の語彙を 1 回ずつ使ってある)。
 */
export function sampleSlideContext(markdown: string = SAMPLE_SLIDE_MARKDOWN): SlideContext {
  return {
    deck: paginate(parseMarkdownBody(markdown).mdast),
    title: "Workers で作る個人サイト",
    author: "吉田 周平 (Shuhei YOSHIDA)",
    event: {
      name: "Cloudflare Meetup Tokyo",
      date: "2026-12-10",
      url: "https://example.com/events/1",
    },
    linkCards: {},
    siteOrigin: "https://yantene.net",
  };
}

export const sampleSlideLabels = {
  previous: "前へ",
  next: "次へ",
  fullscreen: "全画面",
  controls: "スライドの操作",
};
