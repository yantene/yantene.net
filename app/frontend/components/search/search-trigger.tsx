import { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { HiMagnifyingGlass } from "react-icons/hi2";
import { Link } from "react-router";

/*
 * 修飾キーの名前を、サーバーとクライアントで別々に答える。
 *
 * どちらのキーで開くかは読み手の OS で決まり、サーバーには分からない。effect で
 * 書き換えると余分な描画が挟まるので、サーバー用のスナップショットを持てる
 * useSyncExternalStore で受ける (share-menu.tsx と同じ作り)。
 *
 * 購読はしない。読み込んだ後に OS が変わることはない。参照が変わると購読し直しに
 * なるので、関数はモジュールに置いて固定する。
 */
const unsubscribe = (): void => undefined;
const subscribeToNothing = (): (() => void) => unsubscribe;
const isMacHere = (): boolean => /Mac|iPhone|iPad|iPod/u.test(navigator.userAgent);
/** サーバーでは Ctrl と答える。Mac 以外のほうが多く、外したときの違和感が小さい。 */
const isMacOnServer = (): boolean => false;

interface SearchTriggerProps {
  /** パレットを開きたいとき呼ぶ。 */
  readonly onOpen: () => void;
  readonly className?: string;
}

/**
 * 検索の入口。
 *
 * **押し場所は `<a>`。** JavaScript が動かない環境ではパレットが開けないので、そのときは
 * 素のリンクとして記事一覧へ連れて行く。`<button>` にすると、その環境では押しても何も
 * 起きない操作子になる。
 *
 * **連れて行った先に検索欄は無い。** 一覧は「全部を辿る」ページで、探す場所ではない。
 * JavaScript が動かなければ探す手立ては無くなるが、辿ることはできる。
 *
 * 修飾キー付きの押下 (別のタブで開く) はそのまま通す。奪ってしまうと、
 * 「一覧を別タブで開く」ができなくなる。
 */
export function SearchTrigger({ onOpen, className = "" }: SearchTriggerProps): React.JSX.Element {
  const { t } = useTranslation();
  const isMac = useSyncExternalStore(subscribeToNothing, isMacHere, isMacOnServer);

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>): void => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (event.button !== 0) return;

    event.preventDefault();
    onOpen();
  };

  return (
    <Link
      to="/articles"
      onClick={handleClick}
      /*
       * 近道を支援技術にも伝える。見えている `<kbd>` は読み上げから外してあるので、
       * ここに書かないと「キーで開ける」ことが伝わらない。
       */
      aria-keyshortcuts="Meta+K Control+K"
      /*
       * 名前は属性でも与える。狭い画面では字を伏せて絵だけになるので
       * (search-trigger.css)、見えている字に頼ると名前ごと消える。
       */
      aria-label={t("search.title")}
      className={`search-trigger press-control ${className}`}
    >
      <HiMagnifyingGlass className="search-trigger-icon" aria-hidden />
      <span className="search-trigger-label">{t("search.title")}</span>
      {/*
        鍵の絵は読み上げに渡さない。「コマンド ケー」と綴りで読まれるだけで、
        意味は aria-keyshortcuts のほうが正しく伝える。
      */}
      <span className="search-trigger-keys" aria-hidden>
        <kbd>{isMac ? "⌘" : "Ctrl"}</kbd>
        <kbd>K</kbd>
      </span>
    </Link>
  );
}
