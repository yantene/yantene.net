import type { SlideDeck, SlidePage } from "~/lib/slides/deck";

/*
 * デッキの中の現在地と、その送り方 (ADR 0052)。
 *
 * React にも DOM にも触らない。「次へ」を押したときにどこへ行くかは、ここだけを
 * 確かめれば分かる。
 */

/** 現在地。ページ (0 始まり) と、そのページの中の段。 */
export interface SlidePosition {
  readonly page: number;
  readonly step: number;
}

export const FIRST_POSITION: SlidePosition = { page: 0, step: 0 };

/** そのページの最後の段。段を持つのは中身のページだけ。 */
export function lastStepOf(page: SlidePage | undefined): number {
  return page?.kind === "content" ? page.lastStep : 0;
}

/**
 * 1 つ進む。ページの中に出していない段があれば段を、無ければ次のページへ。
 * 最後まで来ていたら動かない。
 */
export function next(deck: SlideDeck, position: SlidePosition): SlidePosition {
  if (position.step < lastStepOf(deck.pages[position.page])) {
    return { page: position.page, step: position.step + 1 };
  }
  if (position.page >= deck.pages.length - 1) return position;
  return { page: position.page + 1, step: 0 };
}

/**
 * 1 つ戻る。段を出していれば段を、無ければ前のページへ。
 *
 * **前のページへ戻ったときは、そのページを全部出した姿にする。** 戻った先で段を
 * 出し直させると、読み返したいだけの人が何度も送ることになる。
 */
export function previous(deck: SlideDeck, position: SlidePosition): SlidePosition {
  if (position.step > 0) return { page: position.page, step: position.step - 1 };
  if (position.page <= 0) return position;
  return { page: position.page - 1, step: lastStepOf(deck.pages[position.page - 1]) };
}

/** 指したページの頭へ。範囲の外は端に寄せる。 */
export function goTo(deck: SlideDeck, page: number): SlidePosition {
  const last = Math.max(deck.pages.length - 1, 0);
  return { page: Math.min(Math.max(Math.trunc(page), 0), last), step: 0 };
}

/**
 * URL のハッシュ (`#3`) を現在地に読む。ページは 1 始まりで書く。
 * 読めなければ undefined (何もしない)。
 */
export function positionFromHash(deck: SlideDeck, hash: string): SlidePosition | undefined {
  const matched = /^#(\d{1,4})$/.exec(hash);
  if (matched === null) return undefined;
  return goTo(deck, Number(matched[1]) - 1);
}

export function hashOf(position: SlidePosition): string {
  return `#${String(position.page + 1)}`;
}

/** 章をまたぐ移動か。トランジションを変えるために問う。 */
export function crossesChapter(deck: SlideDeck, from: SlidePosition, to: SlidePosition): boolean {
  return chapterOf(deck.pages[from.page]) !== chapterOf(deck.pages[to.page]);
}

function chapterOf(page: SlidePage | undefined): number {
  return page?.kind === "content" || page?.kind === "chapter" ? page.chapter : 0;
}

/**
 * いつでも送るキー。左右の矢印はページの上で他の働きを持たない。
 */
const ALWAYS_NEXT = new Set(["ArrowRight"]);
const ALWAYS_PREVIOUS = new Set(["ArrowLeft"]);

/**
 * スライドに向き合っている間だけ送るキー。PageDown / PageUp は発表用のリモコンが送る。
 *
 * ⚠️ **どれもページをスクロールするキーでもある。** いつでも取ると、スライドの下の
 * 読み物へキーボードで降りられなくなる。取るのは、読み手がスライドを触った後か
 * 全画面のときだけ ({@link targetForKey} の `engaged`)。
 */
const ENGAGED_NEXT = new Set(["ArrowDown", "PageDown", " ", "Enter"]);
const ENGAGED_PREVIOUS = new Set(["ArrowUp", "PageUp", "Backspace"]);

/**
 * キーが指す行き先。そのキーで動かないなら undefined (ブラウザの既定に任せる)。
 *
 * `engaged` は、読み手がスライドに向き合っているか (スライドを触った後か、全画面)。
 */
export function targetForKey(
  deck: SlideDeck,
  position: SlidePosition,
  key: string,
  engaged: boolean,
): SlidePosition | undefined {
  if (ALWAYS_NEXT.has(key)) return next(deck, position);
  if (ALWAYS_PREVIOUS.has(key)) return previous(deck, position);
  if (!engaged) return undefined;

  if (ENGAGED_NEXT.has(key)) return next(deck, position);
  if (ENGAGED_PREVIOUS.has(key)) return previous(deck, position);
  if (key === "Home") return goTo(deck, 0);
  if (key === "End") return goTo(deck, deck.pages.length - 1);
  return undefined;
}
