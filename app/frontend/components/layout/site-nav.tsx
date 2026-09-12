import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";

/**
 * ヘッダーが並べる行き先。
 *
 * **帯とドロワーが同じ表を読む。** 狭い画面では畳んで出し直すので、書き写すと
 * 「広い画面にだけ現れる項目」が生まれる。どちらにも出したくない項目はここから外す。
 *
 * Home を置かないのは、ロゴがその役を兼ねているため (header.tsx)。
 *
 * `/about` (#413) `/notes` (#412) `/slides` (#415) はまだ中身が無く、いまは「準備中」の
 * 一文だけを置いたページに繋がっている。**それでもナビには出す。** サイトが何を置く
 * 場所なのかは、置き終わる前から読み手に見えていてよい。
 */
export interface SiteNavItem {
  readonly to: string;
  /** 翻訳キー。字は日英で入れ替わる。 */
  readonly labelKey: string;
}

export const siteNavItems: readonly SiteNavItem[] = [
  { to: "/about", labelKey: "navigation.about" },
  { to: "/articles", labelKey: "navigation.articles" },
  { to: "/notes", labelKey: "navigation.notes" },
  { to: "/slides", labelKey: "navigation.slides" },
];

/**
 * いまその行き先を見ているか。`aria-current="page"` を出すかどうかの判定。
 *
 * 前方一致で見る。記事を読んでいるとき (`/articles/foo`) も一覧 (`/articles`) を
 * 現在地として示したいため。
 *
 * 境目は区切りで見る。`startsWith` だけだと、いつか `/notes-archive` のような行き先が
 * 増えたときに `/notes` まで一緒に光る。
 */
export function isCurrentNavItem(pathname: string, to: string): boolean {
  return pathname === to || pathname.startsWith(`${to}/`);
}

interface SiteNavProps {
  /**
   * `<nav>` に載せる。**出し隠しはここで行うこと。**
   *
   * 中の一覧だけを `display: none` にすると、空のランドマークが支援技術に残り、
   * 「何も無い navigation」が 2 つ並ぶ。
   */
  readonly className?: string;
  /** 並べ方。帯では横一列、ドロワーでは縦に積む。 */
  readonly listClassName?: string;
  /** 項目 1 つぶんの字の大きさと色。地の色が場所ごとに違うので呼ぶ側が渡す。 */
  readonly linkClassName: string;
}

/**
 * サイトの行き先。帯とドロワーの両方がこれを描く。
 *
 * **どちらも `<nav>` で囲む。** 同じ名前のランドマークが 2 つ並ぶように見えるが、
 * 表に出ているのは常に片方だけで、もう片方は `display: none` で支援技術からも
 * 消えている (幅で出し分けている)。
 */
export function SiteNav({
  className,
  listClassName,
  linkClassName,
}: SiteNavProps): React.JSX.Element {
  const { t } = useTranslation();
  const location = useLocation();

  return (
    <nav aria-label={t("navigation.siteNavLabel")} className={className}>
      <ul className={listClassName}>
        {siteNavItems.map((item) => {
          const isCurrent = isCurrentNavItem(location.pathname, item.to);
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                aria-current={isCurrent ? "page" : undefined}
                className={`${linkClassName}${isCurrent ? " site-nav-current" : ""}`}
              >
                {t(item.labelKey)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
