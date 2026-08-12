/**
 * タッチでも `:active` が付くようにする。
 *
 * iOS の Safari は、タッチのイベントを誰も聞いていない画面では要素に `:active` を
 * 付けない。押下の反応 (interaction.css) を `:active` だけで持っているので、これが無いと
 * iPhone でだけ何の手応えも出ない。直そうとしている症状そのものになってしまう。
 *
 * 何もしない listener を document に 1 つ置くだけで、以降は既定どおり `:active` が付く。
 * passive にしてあるので、スクロールの妨げにはならない。
 */
export function enableActiveOnTouch(): void {
  document.addEventListener("touchstart", () => {}, { passive: true });
}
