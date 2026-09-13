import { useId } from "react";
import { useTranslation } from "react-i18next";
import { HiOutlineRss } from "react-icons/hi2";
import { headerMenuGroupName, useDismissableDetails } from "~/frontend/lib/use-dismissable-details";
import { feedIdentities } from "~/lib/feed";

/**
 * フィードの選び場所。帯の絵を押すと、種別ごとのフィードが開く。
 *
 * **器は `<details>`。** JavaScript が動かない環境でも開けて、中のリンクを踏める
 * (SiteMenu と同じ作り)。足しているのは Esc と外押しで畳むことだけ。
 *
 * 並べる中身は `~/lib/feed` の表がそのまま持つ。**ここで行き先を書かない** —
 * 書くと、フィード本体 (backend/handlers/feed.handler) が生やす URL と、ここに出る
 * URL が別々に育つ。
 *
 * **`Notes` と `Slides` はまだ中身が無い** (#412 / #415) が、押せる導線として出す。
 * 返るのは entry 0 件の Atom で、いま購読しておけば中身が入った時点で届く。押せなく
 * すると、その時点で購読している人が誰もいない状態から始まることになる。
 */
export function FeedMenu({ className = "" }: { readonly className?: string }): React.JSX.Element {
  const { t } = useTranslation();
  const { ref } = useDismissableDetails();
  const titleId = useId();

  return (
    /*
      `name` を与えて排他にする。**同じ名前の `<details>` は 1 つしか開かない**ので、
      隣の表示する言語を開けばこちらは畳まれる。

      外押しで畳む仕掛け (useDismissableDetails) は `pointerdown` で受けているため、
      キーボードで開いたとき (summary で Enter) には走らない。両方が開いて板が重なる
      のを、JavaScript を足さずに止められるのがこれ。**対応していないブラウザでは
      両方開くだけ**で、押せなくなるものは無い。
    */
    <details ref={ref} name={headerMenuGroupName} className={`header-menu ${className}`}>
      {/*
        絵しか出さないので名前は aria-label で渡す。開いているかどうかは <details> の
        summary が持つ既定の状態 (aria-expanded) がそのまま伝える。
      */}
      <summary
        className="header-menu-trigger press-control"
        aria-label={t("feed.label")}
        title={t("feed.label")}
      >
        <HiOutlineRss className="header-menu-icon" aria-hidden />
      </summary>

      <div className="header-menu-panel">
        {/*
          見出しを 1 つ置く。絵だけの押し場所から開くので、開いた板の中に「これは
          フィードの一覧である」と書いてある字が無いと、4 つの名前だけが宙に浮く。

          **一覧に結び付ける。** ナビにも同じ字の行き先 (Articles / Notes / Slides) が
          あり、名前だけを読み上げると同じ名前のリンクが 4 つ並ぶ (帯とドロワーで 2 枚
          ずつ描くため)。結び付けておけば「Feed の Articles」として読める。
        */}
        <p id={titleId} className="header-menu-title">
          {t("feed.label")}
        </p>
        <ul aria-labelledby={titleId} className="header-menu-list">
          {feedIdentities.map((identity) => (
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
    </details>
  );
}

/**
 * ドロワー (狭い画面) に置くフィードの一覧。
 *
 * **畳んだ中で更に畳まない。** ドロワー自身が `<details>` なので、この中にもう 1 枚
 * `<details>` を入れると、支援技術には入れ子の開閉として伝わり、開くのに 2 手かかる。
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
        {feedIdentities.map((identity) => (
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
