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
 * スキップリンクはここへ焦点を移す (skip-link.tsx)。焦点を移さずにスクロールだけさせると、
 * 次の Tab がヘッダーの中へ戻ってしまう。また、拡大鏡の中には焦点を追うものがあり、焦点の
 * 当たらない行き先にはついて来ない。
 *
 * ただし `tabIndex={-1}` はここに書かない。焦点を受けられるのは、スキップリンクが移す
 * あいだだけにしてある (理由は skip-link.tsx)。焦点が当たっても輪郭は出さない
 * (skip-link.css)。押せるものではないので、ページ全体を囲む輪郭は現在地の印として役に
 * 立たない。
 */
export function MainContent({ className, children }: MainContentProps): React.JSX.Element {
  const classes = className === undefined ? "main-content" : `main-content ${className}`;
  return (
    <main id={MAIN_CONTENT_ID} className={classes}>
      {children}
    </main>
  );
}
