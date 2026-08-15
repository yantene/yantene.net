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

/**
 * 取り寄せた本体を掴んでおく場所。図が複数あっても本体を読み直さない。
 *
 * ただし成功した結果だけを掴む。転けた Promise を持ち続けると、chunk の取得に一度
 * 失敗しただけで、そのタブでは二度と図が出なくなる。React Router の遷移はクライアント側で
 * 起きるので、図のある別の記事へ回っても同じ Promise を引き当て、読み手がページを
 * 読み直すまで直らない。
 */
const loader: { promise?: Promise<Mermaid> } = {};

/**
 * 本体を取り寄せて初期化する。転けたら掴んだものを捨ててから投げ直す。
 *
 * **捨てているのは、`loadMermaid` が代入した後のものである。** この関数は async 関数で、
 * 最初に行うのが `import()` の await だから、同期的に throw して代入より先に catch 節へ
 * 入ることがない。
 *
 * 投げ直すのは、呼び出し側 (`MermaidDiagram`) が例外を受けて元のコードブロックへ落ちる
 * ため。ここで握り潰すと、図にならないまま印だけが残る。
 *
 * 取り直せるのは次にマウントされる図からで、いま並んでいる図は救わない。同じページの図は
 * 同じコミットで effect が走って同じ Promise を掴むため、片方が転べば両方転ける。
 * その場で読み直す仕掛けは持たせず、次のマウントに任せる。
 */
async function importMermaid(): Promise<Mermaid> {
  try {
    const { default: mermaid } = await import("mermaid");
    mermaid.initialize(mermaidConfig);
    return mermaid;
  } catch (error) {
    loader.promise = undefined;
    throw error;
  }
}

export async function loadMermaid(): Promise<Mermaid> {
  loader.promise ??= importMermaid();
  return loader.promise;
}
