import type { ReactNode } from "react";

/**
 * ページの本文 (`<main>`) の id。スキップリンクの行き先。
 *
 * **ここ 1 か所でだけ綴る。** ページごとに `<main id="...">` を書くと、どこか 1 つで綴りが
 * ずれたときにスキップリンクがそのページでだけ黙って効かなくなる。画面には何も出ないので
 * 気づけない。
 */
export const MAIN_CONTENT_ID = "main-content";

interface MainContentProps {
  readonly className?: string;
  readonly children: ReactNode;
}

/**
 * ページの本文の器 (`<main>`)。どのページもこれを通す。
 *
 * `tabIndex={-1}` はスキップリンクが焦点を移すため。タブ順には入らない。焦点を移さずに
 * スクロールだけさせると、次の Tab がヘッダーの中へ戻ってしまう。また、拡大鏡の中には
 * 焦点を追うものがあり、焦点の当たらない行き先にはついて来ない。
 *
 * 焦点が当たっても輪郭は出さない (skip-link.css)。押せるものではないので、ページ全体を
 * 囲む輪郭は現在地の印として役に立たない。
 */
export function MainContent({ className, children }: MainContentProps): React.JSX.Element {
  const classes = className === undefined ? "main-content" : `main-content ${className}`;
  return (
    <main id={MAIN_CONTENT_ID} tabIndex={-1} className={classes}>
      {children}
    </main>
  );
}
