import type { Mermaid, MermaidConfig } from "mermaid";

/*
 * Mermaid 本体の取り寄せ口。**ファイル名の `.client` に意味がある。**
 *
 * React Router は `*.client.ts` をサーバー側のビルドから外し、export を `undefined` に
 * 差し替える。ここを普通のモジュールにすると、`import("mermaid")` が Workers 側の
 * モジュールグラフにも載り、実行されないコードが 100 本を超えるチャンク (図の種類ごとに
 * 分かれる) として Worker に積まれる。呼ぶのは `useEffect` の中だけなので、
 * サーバーでは export が `undefined` のままでよい。
 *
 * ブラウザ側では動的 import のままなので、図のある記事を開いたときにだけ取り寄せられる。
 * **静的 import にしないこと。** Mermaid は展開すると 1MB を超え、静的に読むと図の無い
 * 記事にも同じ JS が届く。
 */

/*
 * 書いていない項目は既定のまま。
 *
 * - `securityLevel: "strict"` — ラベルの中の HTML を許さず、`click` によるハンドラ登録も
 *   無効にする。本文は自分で書いたものだが、組むのは読み手のブラウザなので締めておく。
 * - `suppressErrorRendering` — 構文が読めなかったとき、Mermaid が「爆弾」の SVG を DOM へ
 *   差し込むのを止める。ここでは読めなければ元のコードブロックを出すので、その手前で
 *   例外だけを返してもらう。
 * - `theme: "neutral"` — サイトの配色には合わせない。Mermaid は themeVariables から
 *   派生色を自分で計算するため `var(--color-primary)` を渡せず、app.css の hex を写すと
 *   配色が 2 か所に散る。白地の本文には中間色の neutral が馴染む。**テーマの出し分けも
 *   要らない。** このサイトは light 固定で、ダークテーマを持たない (app.css の daisyUI
 *   テーマ `yantene` は `color-scheme: light`)。
 * - `fontFamily` — 図の中の字だけは本文と揃える。ここは色と違って Mermaid が値を計算せず、
 *   生成する CSS にそのまま流すだけなので、CSS 変数を渡せる。
 */
const mermaidConfig: MermaidConfig = {
  startOnLoad: false,
  securityLevel: "strict",
  suppressErrorRendering: true,
  theme: "neutral",
  fontFamily: "var(--body-font-stack)",
};

/** 取り寄せは 1 度だけ。図が複数あっても本体を読み直さない。 */
const loader: { promise?: Promise<Mermaid> } = {};

async function importMermaid(): Promise<Mermaid> {
  const { default: mermaid } = await import("mermaid");
  mermaid.initialize(mermaidConfig);
  return mermaid;
}

export async function loadMermaid(): Promise<Mermaid> {
  loader.promise ??= importMermaid();
  return loader.promise;
}
