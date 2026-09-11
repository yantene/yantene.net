import { useEffect } from "react";

/**
 * いま起きているスクロールを滑らせてよい、という印。CSS がこの属性を見て
 * `scroll-behavior` を切り替える (app.css)。
 */
const SMOOTH_ATTRIBUTE = "data-smooth-scroll";

/**
 * `scrollend` の来ない環境で印を落とすための保険。
 *
 * 滑り終えるのに要る時間より長く、次にリンクを押すまでの間より短いあたり。長すぎると、
 * 続けて押した別ページへの遷移まで滑ってしまう。
 */
const FALLBACK_MS = 1200;

/** 次に起きるスクロールを滑らせる。滑り終えたら自分で印を落とす。 */
function beginSmoothScroll(): void {
  const root = document.documentElement;
  root.setAttribute(SMOOTH_ATTRIBUTE, "");

  // 型は環境で揺れる (DOM は number、Node は Timeout)。戻り値をそのまま持ち回す。
  let timer: ReturnType<typeof globalThis.setTimeout> | undefined;
  const clear = (): void => {
    root.removeAttribute(SMOOTH_ATTRIBUTE);
    document.removeEventListener("scrollend", clear);
    if (timer !== undefined) globalThis.clearTimeout(timer);
  };
  timer = globalThis.setTimeout(clear, FALLBACK_MS);
  document.addEventListener("scrollend", clear, { once: true });
}

/** 押されたのが、いま見ているページの中を指すリンクか。 */
function isInPageLink(anchor: HTMLAnchorElement): boolean {
  if (anchor.hash === "") return false;
  // 行き先が別のページなら、上端に戻る動きであって「ページの中を移る」動きではない。
  return anchor.origin === window.location.origin && anchor.pathname === window.location.pathname;
}

/**
 * ページの中を移るときだけ、スクロールを滑らせる。
 *
 * `scroll-behavior: smooth` を html に据え置きにはできない。`<ScrollRestoration>` は
 * ページ遷移で `window.scrollTo(0, 0)`、戻る操作で `window.scrollTo(0, 保存位置)` を
 * 呼び、hydration より前に走るインラインスクリプトも同じことをする。据え置きにすると
 * これらが揃って滑り、記事の途中から別のページへ移ったときに、新しい中身が前の位置で
 * 映ってから上端へ流れていく。読み手には遷移したのかどうかが分からない。
 *
 * そこで、ページの中を指すリンクが押された瞬間だけ印を立て、滑り終えたら落とす。
 * スクロールそのものは今までどおり `<ScrollRestoration>` に任せる。こちらで
 * `scrollIntoView` を呼ぶと、直後に走るあちらの scroll が上書きして結局飛ぶ。
 *
 * リンクごとに仕掛けず、文書の上で 1 つだけ受ける。目次・見出しのパーマリンク・脚注と
 * 入口が散らばっており、置き忘れた場所だけが飛ぶ、という差を作りたくない。
 */
export function useSmoothHashScroll(): void {
  useEffect(() => {
    const onClick = (event: MouseEvent): void => {
      // 修飾キー付き・中クリックは別のタブや窓へ開くもので、この文書は動かない。
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as HTMLElement | null)?.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (!isInPageLink(anchor)) return;

      beginSmoothScroll();
    };

    /*
     * 捕捉の段で受ける。react-router の Link は自分の onClick で遷移を始めるので、
     * 泡立ちの段で待つと印を立てる前にスクロールが走りうる。
     */
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
    };
  }, []);
}
