import { useTranslation } from "react-i18next";
import { HiOutlineRss } from "react-icons/hi2";

type FeedLinkProps = {
  /**
   * 購読先。既定はサイト全体のフィード。タグで絞った一覧など、その場に対応する
   * フィードがあるときはそちらを渡す。
   */
  readonly href?: string;
  /**
   * リンクの文言。1 つの画面に行き先の違うフィードが並ぶとき (一覧の見出しと
   * フッター) は、どちらを指しているかが文言で分かるようにする。
   */
  readonly label?: string;
  /**
   * 文字の大きさと色。置き場所 (フッターの帯・一覧の見出し脇) で地の色が違うので
   * 呼び出し側が差し替えられるようにしてある。既定値は上書きではなく置き換えなので、
   * 渡すときは大きさと色の両方を指定すること。
   */
  readonly className?: string;
};

/**
 * Atom フィードへの導線。
 *
 * `/feed.xml` は Hono が応答するエンドポイントで React Router のルートではないため、
 * `<Link>` ではなく素の `<a>` を使う (`<Link>` だと loader を取りに行って行き止まる)。
 */
export function FeedLink({
  href = "/feed.xml",
  label,
  className = "text-sm text-base-content/60",
}: FeedLinkProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <a
      href={href}
      type="application/atom+xml"
      className={`inline-flex items-center gap-1.5 underline-offset-4 transition-colors hover:text-primary hover:underline ${className}`}
    >
      <HiOutlineRss aria-hidden="true" />
      {label ?? t("feed.label")}
    </a>
  );
}
