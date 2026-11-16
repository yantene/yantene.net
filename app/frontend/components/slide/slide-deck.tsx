import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { SlidePage, numbered } from "./slide-page";
import {
  FIRST_POSITION,
  crossesChapter,
  goTo,
  hashOf,
  next,
  positionFromHash,
  previous,
} from "./slide-navigation";
import type { SlideContext } from "./slide-page";
import type { SlidePosition } from "./slide-navigation";

export interface SlideDeckLabels {
  readonly previous: string;
  readonly next: string;
  readonly fullscreen: string;
  /** 操作の並びの名前 (読み上げ用)。 */
  readonly controls: string;
}

export interface SlideDeckProps {
  readonly context: SlideContext;
  readonly labels: SlideDeckLabels;
}

/** 指で払ったとみなす、横の動きの下限 (px)。 */
const SWIPE_THRESHOLD = 40;

/** 送るキーと戻すキー。PageDown / PageUp は発表用のリモコンが送る。 */
const NEXT_KEYS = new Set(["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"]);
const PREVIOUS_KEYS = new Set(["ArrowLeft", "ArrowUp", "PageUp", "Backspace"]);

/** 押したときにページを送らない場所。そこ自身の働き (リンク・拡大・コピー) を優先する。 */
const INTERACTIVE = "a, button, summary, input, textarea, select, [role='dialog']";

/**
 * スライドを再生する (ADR 0052)。
 *
 * **サーバーは全ページを縦に並べて描く。** JavaScript が動き出したら `data-playing` を
 * 立て、そこから先は 1 ページずつ見せる。動かない環境・クローラー・印刷には、縦に
 * 並んだ全ページがそのまま届く (出力は 1 つで、出し分けは CSS)。
 *
 * 現在地は URL のハッシュ (`#3`) に持つ。サーバーはハッシュを見られないので、最初の
 * 描画は必ず 1 ページ目で、ハッシュを読むのは描いたあと (hydration で食い違わせない)。
 */
export function SlideDeck({ context, labels }: SlideDeckProps): React.JSX.Element {
  const { deck } = context;
  const [position, setPosition] = useState<SlidePosition>(FIRST_POSITION);
  // サーバーでは偽、ブラウザで動き出したら真。再生に切り替える合図になる。
  const playing = useSyncExternalStore(subscribeToNothing, isInBrowser, isOnServer);
  const stageRef = useRef<HTMLDivElement>(null);
  /*
   * いまの現在地を、キーやクリックのハンドラから読むための写し。state を依存に入れると、
   * 1 つ送るたびに window のリスナーを付け直すことになる。
   */
  const positionRef = useRef(position);
  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  const move = useCallback(
    (to: SlidePosition) => {
      const from = positionRef.current;
      if (to.page === from.page && to.step === from.step) return;
      const update = (): void => {
        setPosition(to);
      };
      // 段を送るだけならページは替わらない。動かすのは CSS の transition で足りる。
      if (to.page === from.page) {
        update();
        return;
      }
      transition(update, crossesChapter(deck, from, to) ? "slide-chapter" : "slide-page");
    },
    [deck],
  );

  /*
   * 動き出したら、ハッシュが指すページへ移る。**最初の描画には使わない** (サーバーは
   * ハッシュを見られないので、描いたあとに読む)。あとからハッシュが変わったときも従う。
   */
  useEffect(() => {
    function followHash(): void {
      const target = positionFromHash(deck, globalThis.location.hash);
      if (target !== undefined) move(target);
    }
    followHash();
    globalThis.addEventListener("hashchange", followHash);
    return () => {
      globalThis.removeEventListener("hashchange", followHash);
    };
  }, [deck, move]);

  // 現在地を URL に写す。履歴は積まない (戻るボタンでページを 1 枚ずつ戻らせない)。
  useEffect(() => {
    if (!playing) return;
    const hash = hashOf(position);
    if (globalThis.location.hash !== hash) globalThis.history.replaceState(null, "", hash);
  }, [playing, position]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (isTyping(event) || event.metaKey || event.ctrlKey || event.altKey) return;
      const current = positionRef.current;
      const target = targetFor(event.key, current);
      if (target === undefined) return;
      event.preventDefault();
      move(target);
    }
    function targetFor(key: string, current: SlidePosition): SlidePosition | undefined {
      if (NEXT_KEYS.has(key)) return next(deck, current);
      if (PREVIOUS_KEYS.has(key)) return previous(deck, current);
      if (key === "Home") return goTo(deck, 0);
      if (key === "End") return goTo(deck, deck.pages.length - 1);
      return undefined;
    }
    globalThis.addEventListener("keydown", onKeyDown);
    return () => {
      globalThis.removeEventListener("keydown", onKeyDown);
    };
  }, [deck, move]);

  const goNext = useCallback(() => {
    move(next(deck, positionRef.current));
  }, [deck, move]);
  const goPrevious = useCallback(() => {
    move(previous(deck, positionRef.current));
  }, [deck, move]);

  const swipeStart = useRef<number | null>(null);
  const onPointerDown = (event: React.PointerEvent): void => {
    swipeStart.current = event.pointerType === "touch" ? event.clientX : null;
  };
  const onPointerUp = (event: React.PointerEvent): void => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (start === null) return;
    const moved = event.clientX - start;
    if (moved <= -SWIPE_THRESHOLD) goNext();
    if (moved >= SWIPE_THRESHOLD) goPrevious();
  };
  // マウスで押したら送る。指は払って送るので、押しただけでは送らない (誤って送らせない)。
  const onClick = (event: React.MouseEvent): void => {
    if (!playing || (event.nativeEvent as PointerEvent).pointerType === "touch") return;
    if ((event.target as Element).closest(INTERACTIVE) !== null) return;
    if ((globalThis.getSelection()?.toString() ?? "") !== "") return;
    goNext();
  };

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement !== null) {
      void document.exitFullscreen();
      return;
    }
    void stageRef.current?.requestFullscreen();
  }, []);

  return (
    <div className="slide-deck" data-playing={playing ? "" : undefined}>
      {/* oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- 同じ働きはキー (window の keydown) と下の操作の並びが持つ */}
      <div
        ref={stageRef}
        className="slide-stage"
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        {numbered(deck.pages).map(({ item: page, number }) => (
          // ページは並べ替わらないので、ページ番号がそのまま身元になる。
          <div
            key={number}
            className={`slide-frame ${number === position.page + 1 ? "is-current" : ""}`}
          >
            <SlidePage
              page={page}
              number={number}
              // 見ていないページは全部出した姿で持つ (戻ったときと、再生していないとき)。
              step={number === position.page + 1 ? position.step : Number.POSITIVE_INFINITY}
              context={context}
            />
          </div>
        ))}
      </div>

      <div className="slide-controls" role="group" aria-label={labels.controls}>
        <button
          type="button"
          className="slide-control press-control"
          onClick={goPrevious}
          disabled={position.page === 0 && position.step === 0}
        >
          {labels.previous}
        </button>
        <p className="slide-position" aria-live="polite">
          {position.page + 1} / {deck.pages.length}
        </p>
        <button
          type="button"
          className="slide-control press-control"
          onClick={goNext}
          disabled={isAtEnd(context, position)}
        >
          {labels.next}
        </button>
        <button type="button" className="slide-control press-control" onClick={toggleFullscreen}>
          {labels.fullscreen}
        </button>
      </div>
    </div>
  );
}

function subscribeToNothing(): () => void {
  return () => {};
}

function isInBrowser(): boolean {
  return true;
}

function isOnServer(): boolean {
  return false;
}

function isAtEnd(context: SlideContext, position: SlidePosition): boolean {
  const end = next(context.deck, position);
  return end.page === position.page && end.step === position.step;
}

/** 字を打っている最中か、何かが前に開いているか。そのときはキーを奪わない。 */
function isTyping(event: KeyboardEvent): boolean {
  const target = event.target;
  if (target instanceof HTMLElement) {
    if (target.isContentEditable) return true;
    if (target.closest("input, textarea, select, [role='dialog'], dialog") !== null) return true;
  }
  return document.querySelector("dialog[open], [role='dialog']") !== null;
}

/**
 * ページの入れ替えを、ブラウザの View Transitions に載せる。
 *
 * 使えないブラウザと、動きを減らす設定の読み手には、そのまま入れ替える。
 * 種類 (`slide-page` / `slide-chapter`) は CSS が読み、章をまたぐときだけ動きを変える。
 */
function transition(update: () => void, type: string): void {
  const reduced = globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || typeof document.startViewTransition !== "function") {
    update();
    return;
  }
  const run = (): void => {
    flushSync(update);
  };
  try {
    document.startViewTransition({ update: run, types: [type] });
  } catch {
    // 種類を受け取らない実装 (古い Chrome)。動きは既定のものになる。
    document.startViewTransition(run);
  }
}
