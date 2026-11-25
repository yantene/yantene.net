import { useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";
import { HiBars3, HiXMark } from "react-icons/hi2";
import { useLocation } from "react-router";
import { LocaleSwitch } from "./locale-switch";
import { SiteNav } from "./site-nav";
import { FeedMenuList } from "~/frontend/components/feed/feed-menu";

interface SiteMenuProps {
  /** 出し隠し。広い画面では帯に直接並べるので、こちらは伏せる。 */
  readonly className?: string;
}

/**
 * 狭い画面のためのドロワー。行き先・表示言語・出ていく先をまとめて畳んでおく。
 *
 * **器は Popover API** (`popover="auto"` と、それを指す `popovertarget` の押し場所)。
 * 開閉は属性だけで決まるので、JavaScript が動かない環境でも開けて、中のリンクを踏める。
 * `<dialog>` を `showModal()` で開く形や自前の開閉状態にすると、その環境ではハンバーガーが
 * 押しても何も起きない飾りになる。
 *
 * 外押し・Esc で畳むこと、畳んだあと焦点をハンバーガーへ戻すことはブラウザが持つ。
 * JavaScript が足すのは「遷移したら畳む」の 1 つだけで、無くても操作は最後まで通る。
 */
export function SiteMenu({ className = "" }: SiteMenuProps): React.JSX.Element {
  const { t } = useTranslation();
  const location = useLocation();
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  /*
   * 行き先を選んだら畳む。`<Link>` の遷移ではページが読み直されないので、放っておくと
   * 次のページでも開いたままになる。
   *
   * 前に描いた場所を覚えておいて、**変わったときだけ**畳む。移ったかどうかを見ずに
   * 畳むと、最初の描画でも 1 度走る。いまは何も起きないが、いつか「開いた状態で
   * 描き始める」使い方をしたときに、黙って閉じられることになる。
   *
   * 閉じている板に `hidePopover()` を呼んでも何も起きない (例外も投げない)。Popover API の
   * 無い環境 (テストの happy-dom を含む) では呼ぶ先が無いので、確かめてから呼ぶ。
   */
  const currentPath = `${location.pathname}${location.search}`;
  const shownPathRef = useRef(currentPath);
  useEffect(() => {
    if (shownPathRef.current === currentPath) return;

    shownPathRef.current = currentPath;
    const panel = panelRef.current;
    if (panel === null || typeof panel.hidePopover !== "function") return;
    panel.hidePopover();
  }, [currentPath]);

  return (
    <div className={`site-menu ${className}`}>
      {/*
        絵しか出さないので名前は aria-label で渡す。開いているかどうかは、popovertarget を
        持つ押し場所としてブラウザが伝える (aria-expanded を手で書かない)。
      */}
      <button
        type="button"
        popoverTarget={panelId}
        aria-controls={panelId}
        className="site-menu-trigger press-control"
        aria-label={t("navigation.menuLabel")}
      >
        {/* 開閉で絵を差し替えるのは CSS 側 (header.css)。JavaScript は要らない。 */}
        <HiBars3 className="site-menu-icon site-menu-icon-closed" aria-hidden />
        <HiXMark className="site-menu-icon site-menu-icon-opened" aria-hidden />
      </button>

      {/*
        板はハンバーガーのすぐ後ろに置く。離すと、ブラウザが押し場所に暗黙の
        aria-details を足し、読み上げに余計な繋がりが 1 つ増える。
      */}
      <div ref={panelRef} id={panelId} popover="auto" className="site-menu-panel">
        <SiteNav listClassName="site-menu-list" linkClassName="site-menu-link press-surface" />

        {/*
          足元には表示する言語とフィードを置く。**帯に並ぶものと過不足なく同じにする。**
          ドロワーは狭い画面での帯そのものなので、ここにだけある導線を作ると、画面の幅で
          出来ることが変わる。

          **畳んだ中で更に畳まない。** 帯では絵を押して開く形 (LocaleMenu / FeedMenu) だが、
          ここは既に畳んだ板 (popover) の中なので、入れ子の開閉にすると開くのに 2 手かかり、
          支援技術にもそのまま伝わる。行き先は同じ表から引くので、出来ることは変わらない。

          **ソーシャルメディアは置かない。** あれは「誰か」の情報で、行き先と道具を並べる
          場所には属さない (帯にも無い)。持つのはヒーローと、いずれプロフィール (#413)。
        */}
        <div className="site-menu-foot">
          <FeedMenuList />
          <LocaleSwitch />
        </div>
      </div>
    </div>
  );
}
