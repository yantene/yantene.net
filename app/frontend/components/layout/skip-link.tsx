import { useTranslation } from "react-i18next";
import { MAIN_CONTENT_ID } from "./main-content";

/**
 * ヘッダーを飛ばして本文へ移るリンク。ページの最初の焦点になる。
 *
 * 焦点が当たったときだけ見える (skip-link.css)。行き先は `MainContent` の `<main>`。
 *
 * 押したときは自分で焦点を移す。素の `#main-content` に任せると、React Router の
 * `<ScrollRestoration>` がハッシュの移動を打ち消すことがあり、`Link` で渡すとスクロールは
 * するが焦点はリンクに残る。どちらも次の Tab がヘッダーの中へ戻る。`href` は JavaScript が
 * 動かない環境のために残してあり、そこではブラウザが自分で焦点を移す。
 */
export function SkipLink(): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <a href={`#${MAIN_CONTENT_ID}`} className="skip-link" onClick={handleClick}>
      {t("skipLink.label")}
    </a>
  );
}

function handleClick(event: React.MouseEvent<HTMLAnchorElement>): void {
  const target = document.getElementById(MAIN_CONTENT_ID);
  // 行き先が無いページでは、ブラウザに任せる (どこへも行かないだけで壊れない)。
  if (target === null) return;

  event.preventDefault();
  /*
   * 焦点を受けられるのは移すあいだだけにする。`<main>` に `tabindex="-1"` を常に置くと、
   * 本文の字をクリックするたびに `<main>` に焦点が移り、次の Tab がクリックした場所では
   * なく本文の頭から始まってしまう。
   */
  target.setAttribute("tabindex", "-1");
  target.addEventListener("blur", () => target.removeAttribute("tabindex"), { once: true });
  target.focus();
}
