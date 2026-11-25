/**
 * スクロールバーの場所を空けておく印 (`html[data-modal-gutter]`)。見た目は
 * `app/frontend/scrollbar-gutter.css` が持つ。
 *
 * モーダルを開いている間、後ろのページは `html` の `overflow: hidden` で止めてある
 * (検索パレットと脚注のドロワー)。止めるとスクロールバーが消えるので、その幅
 * (GNU/Linux と Windows で 15px 前後) のぶん中身が横へ寄る。空けておけば寄らない。
 *
 * ただし**そもそもスクロールバーが出ていないページで空けると、今度は逆へ寄る**。
 * だから「いま出ているか」を測ってから立てる。スクロールバーが画面に重なる環境
 * (macOS や多くのタッチ端末の既定) では幅が 0 なので、印は立たない。
 */
const SCROLLBAR_GUTTER_ATTRIBUTE = "data-modal-gutter";

/**
 * スクロールバーが出ていれば、その場所を空けておく。返す関数で印を降ろす。
 *
 * **錠を掛ける前に呼ぶこと。** 掛けたあとはスクロールバーが消えているので、何を測っても
 * 0 になる。`innerWidth` は画面の幅、`clientWidth` はスクロールバーを除いた幅。
 */
export function reserveScrollbarGutter(): () => void {
  const root = document.documentElement;
  root.toggleAttribute(SCROLLBAR_GUTTER_ATTRIBUTE, globalThis.innerWidth > root.clientWidth);

  return () => {
    root.removeAttribute(SCROLLBAR_GUTTER_ATTRIBUTE);
  };
}
