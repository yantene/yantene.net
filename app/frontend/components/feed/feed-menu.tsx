import { useId } from "react";
import { useTranslation } from "react-i18next";
import { HiOutlineRss } from "react-icons/hi2";
import { listedFeedIdentities } from "~/lib/feed";

/**
 * フィードの選び場所。帯の絵を押すと、種別ごとのフィードが開く。
 *
 * **器は Popover API** (`popover="auto"` と、それを指す `popovertarget` の押し場所)。
 * 開閉は属性だけで決まるので、JavaScript が動かない環境でも開けて、中のリンクを踏める。
 * 外押し・Esc で畳むこと、畳んだあと焦点を押し場所へ戻すこと、隣の表示する言語と
 * 同時に開かないこと (auto の popover は互いを閉じ合う) は、どれもブラウザが持つ
 * (SiteMenu / LocaleMenu と同じ作り)。
 *
 * 並べる中身は `~/lib/feed` の表がそのまま持つ。**ここで行き先を書かない** —
 * 書くと、フィード本体 (backend/handlers/feed.handler) が生やす URL と、ここに出る
 * URL が別々に育つ。
 *
 * **`Slides` はまだ中身が無い** (#415) が、押せる導線として出す。返るのは entry 0 件の
 * Atom で、いま購読しておけば中身が入った時点で届く。押せなくすると、その時点で
 * 購読している人が誰もいない状態から始まることになる。
 *
 * **`Notes` は並べない** (#412)。フィードは実在するが、ナビが名乗っていない場所を
 * ここだけが名乗ることになるため。何を出すかは表の側 (`listedFeedIdentities`) が決める。
 */
export function FeedMenu({ className = "" }: { readonly className?: string }): React.JSX.Element {
  const { t } = useTranslation();
  const panelId = useId();
  const titleId = useId();

  return (
    <div className={`header-menu ${className}`}>
      {/*
        絵しか出さないので名前は aria-label で渡す。開いているかどうかは、popovertarget を
        持つ押し場所としてブラウザが伝える (aria-expanded を手で書かない)。
      */}
      <button
        type="button"
        popoverTarget={panelId}
        aria-controls={panelId}
        className="header-menu-trigger feed-menu-trigger press-control"
        aria-label={t("feed.label")}
        title={t("feed.label")}
      >
        <HiOutlineRss className="header-menu-icon" aria-hidden />
      </button>

      {/*
        板は押し場所のすぐ後ろに置く。離すと、ブラウザが押し場所に暗黙の
        aria-details を足し、読み上げに余計な繋がりが 1 つ増える。
      */}
      <div id={panelId} popover="auto" className="header-menu-panel feed-menu-panel">
        {/*
          見出しを 1 つ置く。絵だけの押し場所から開くので、開いた板の中に「これは
          フィードの一覧である」と書いてある字が無いと、名前だけが宙に浮く。

          **一覧に結び付ける。** ナビにも同じ字の行き先 (Articles / Slides) が
          あり、名前だけを読み上げると同じ名前のリンクが 4 つ並ぶ (帯とドロワーで 2 枚
          ずつ描くため)。結び付けておけば「Feed の Articles」として読める。
        */}
        <p id={titleId} className="header-menu-title">
          {t("feed.label")}
        </p>
        <ul aria-labelledby={titleId} className="header-menu-list">
          {listedFeedIdentities.map((identity) => (
            <li key={identity.kind}>
              {/*
                `<Link>` ではなく素の `<a>`。フィードは Hono が応答するエンドポイントで
                React Router のルートではないため、`<Link>` だと loader を取りに行って
                行き止まる。
              */}
              <a
                href={identity.path}
                type="application/atom+xml"
                className="header-menu-item press-surface"
              >
                {t(identity.labelKey)}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * ドロワー (狭い画面) に置くフィードの一覧。
 *
 * **畳んだ中で更に畳まない。** ドロワー自身が畳んだ板 (popover) なので、この中に
 * もう 1 枚開閉を入れると、支援技術には入れ子の開閉として伝わり、開くのに 2 手かかる。
 * 行き先は同じ表から引くので、帯とドロワーで出来ることは変わらない。
 */
export function FeedMenuList(): React.JSX.Element {
  const { t } = useTranslation();
  const titleId = useId();

  return (
    <div className="site-menu-feeds">
      <p id={titleId} className="header-menu-title">
        {t("feed.label")}
      </p>
      <ul aria-labelledby={titleId} className="site-menu-feed-list">
        {listedFeedIdentities.map((identity) => (
          <li key={identity.kind}>
            <a
              href={identity.path}
              type="application/atom+xml"
              className="site-menu-feed-link press-control"
            >
              {t(identity.labelKey)}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
