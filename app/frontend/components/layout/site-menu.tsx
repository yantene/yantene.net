import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { HiBars3, HiXMark } from "react-icons/hi2";
import { useLocation } from "react-router";
import { LocaleSwitch } from "./locale-switch";
import { SiteNav } from "./site-nav";
import { FeedMenuList } from "~/frontend/components/feed/feed-menu";
import { useDismissableDetails } from "~/frontend/lib/use-dismissable-details";

interface SiteMenuProps {
  /** 出し隠し。広い画面では帯に直接並べるので、こちらは伏せる。 */
  readonly className?: string;
}

/**
 * 狭い画面のためのドロワー。行き先・表示言語・出ていく先をまとめて畳んでおく。
 *
 * **器は `<details>`。** JavaScript が動かない環境でも開けて、中のリンクを踏める。
 * `<dialog>` や自前の開閉状態にすると、その環境ではハンバーガーが押しても何も
 * 起きない飾りになる。
 *
 * JavaScript が動くときは、そこに 3 つだけ足す — 遷移したら畳む・Esc で畳む・
 * 外を押したら畳む。どれも「開いたまま置き去りにしない」ためのもので、無くても
 * 操作は最後まで通る。後ろの 2 つは帯の他の開閉と共通 (useDismissableDetails)。
 */
export function SiteMenu({ className = "" }: SiteMenuProps): React.JSX.Element {
  const { t } = useTranslation();
  const location = useLocation();
  /* Esc と外押しで畳むぶんは、帯の他の開閉 (フィード・表示する言語) と同じものを使う。 */
  const { ref: detailsRef, close: closeMenu } = useDismissableDetails();

  /*
   * 行き先を選んだら畳む。`<Link>` の遷移ではページが読み直されないので、放っておくと
   * 次のページでも開いたままになる。
   *
   * 前に描いた場所を覚えておいて、**変わったときだけ**畳む。移ったかどうかを見ずに
   * 畳むと、最初の描画でも 1 度走る。いまは何も起きないが、いつか「開いた状態で
   * 描き始める」使い方をしたときに、黙って閉じられることになる。
   */
  const currentPath = `${location.pathname}${location.search}`;
  const shownPathRef = useRef(currentPath);
  useEffect(() => {
    if (shownPathRef.current === currentPath) return;

    shownPathRef.current = currentPath;
    closeMenu();
  }, [currentPath, closeMenu]);

  return (
    <details ref={detailsRef} className={`site-menu ${className}`}>
      {/*
        絵しか出さないので名前は aria-label で渡す。開いているかどうかは <details> の
        summary が持つ既定の状態 (aria-expanded) がそのまま伝える。
      */}
      <summary className="site-menu-trigger press-control" aria-label={t("navigation.menuLabel")}>
        {/* 開閉で絵を差し替えるのは CSS 側 (header.css)。JavaScript は要らない。 */}
        <HiBars3 className="site-menu-icon site-menu-icon-closed" aria-hidden />
        <HiXMark className="site-menu-icon site-menu-icon-opened" aria-hidden />
      </summary>

      <div className="site-menu-panel">
        <SiteNav listClassName="site-menu-list" linkClassName="site-menu-link press-surface" />

        {/*
          足元には表示する言語とフィードを置く。**帯に並ぶものと過不足なく同じにする。**
          ドロワーは狭い画面での帯そのものなので、ここにだけある導線を作ると、画面の幅で
          出来ることが変わる。

          **畳んだ中で更に畳まない。** 帯では絵を押して開く形 (LocaleMenu / FeedMenu) だが、
          ここは既に `<details>` の中なので、入れ子の開閉にすると開くのに 2 手かかり、
          支援技術にもそのまま伝わる。行き先は同じ表から引くので、出来ることは変わらない。

          **ソーシャルメディアは置かない。** あれは「誰か」の情報で、行き先と道具を並べる
          場所には属さない (帯にも無い)。持つのはヒーローと、いずれプロフィール (#413)。
        */}
        <div className="site-menu-foot">
          <FeedMenuList />
          <LocaleSwitch />
        </div>
      </div>
    </details>
  );
}
