import { useTranslation } from "react-i18next";
import { HiOutlineScale } from "react-icons/hi2";
import { Link } from "react-router";
import type { CopyrightYears } from "~/backend/handlers/copyright-years";
import {
  FeedLink,
  INLINE_ICON_LINK,
} from "~/frontend/components/feed/feed-link";

interface FooterProps {
  /**
   * 著作権表示に出す期間。ここで時計を読まず loader が決めた値を受け取るのは、
   * SSR とクライアントで必ず同じ年を出すため (理由は handlers/copyright.ts にある)。
   */
  readonly copyright: CopyrightYears;
}

/** 折り返さない空き。並の空白と違い、ここで行が分かれない。 */
const NBSP = "\u{A0}";

/**
 * 期間を著作権表示の形に組む。同じ年なら 1 つだけ出す (「2026 – 2026」は書かない)。
 *
 * 区切りは en ダッシュ。年の範囲に使う約物で、ハイフンより意味が狭い。左右に空きを
 * 入れるのは、和文の地の文に挟まると詰めたままでは字面が繋がって見えるため。
 *
 * 空きは NBSP (U+00A0)。並の空白だと、狭い画面や文字を大きくしたときに
 * 「© 2019 –」で折れて、ダッシュが行末に取り残される。
 */
function formatCopyrightYears({ from, to }: CopyrightYears): string {
  if (from === to) return String(from);

  return `${String(from)}${NBSP}–${NBSP}${String(to)}`;
}

// ページの足元の地面。地平線を一本引くだけに留める (見た目は footer.css が持つ)。
export function Footer({ copyright }: FooterProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <p className="text-xs text-foreground/80">
          &copy; {formatCopyrightYears(copyright)} やんてね
        </p>
        {/*
          全ページの足元に置く常設の導線。読み終えて出ていく場所が、この先も
          繋がっていられること (フィード) と、何の上に立っているか (ライセンス) を示す。
        */}
        {/*
          名前を与える。ヘッダーにも nav があるので、無名のままだと支援技術の
          ランドマーク一覧に「navigation」が 2 つ並び、どちらがどこか区別できない。
        */}
        <nav aria-label={t("footer.navLabel")} className="site-footer-links">
          <FeedLink className="text-xs text-foreground/80" />
          {/*
            絵文字と書体の帰属はライセンスのページが持つ。CC BY 4.0 は、媒体の都合が
            あるときは帰属をまとめた場所へのリンクで条件を満たせると定めている
            (4.0 の 3(a)(2))。足元に全部を並べるより、リンク 1 本のほうが読める。
          */}
          {/*
            見た目はフィードの導線と同じものを使う (INLINE_ICON_LINK)。並んで置くので、
            間隔や下線が片方だけ変わると行が不揃いになる。書き写すと黙ってズレるため、
            揃っていることをコメントではなく共有で担保する。
            絵の意味は文字が持つので、読み上げには渡さない。
          */}
          <Link
            to="/licenses"
            className={`${INLINE_ICON_LINK} text-xs text-foreground/80`}
          >
            <HiOutlineScale aria-hidden="true" />
            {t("footer.licenses")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
