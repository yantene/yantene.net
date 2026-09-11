import { use } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { TocHeadingsContext } from "./toc-context";

/**
 * これ未満の節数なら目次を出さない。
 *
 * 数えるのは h2 だけ。右カラムの目次は見出しの総数で数えるが、こちらは h3 を出さない
 * ので、同じ数え方にすると「h2 が 1 つ + h3 が 3 つ」の記事で 1 項目だけの目次が出る。
 * 1 項目の目次は、押せる場所が増えるだけで全体像を伝えない。
 */
const MIN_SECTIONS = 2;

/**
 * 本文に差し込む目次。最初の h2 の直前に置かれる (mdast-renderer.tsx が差し込む)。
 *
 * 右カラムの目次 (table-of-contents.tsx) が出ない幅のための代わり。開いたまま置く。
 * 畳むと、読み始める前に構造を見せるという目的にひと手間が挟まるうえ、畳んだ姿は
 * 見出しの並びを伝えないので置いている意味が薄れる。読み進めてからの入口は上端の
 * 節名バー (current-section) が別に持っている。
 *
 * 拾うのは h2 だけにする。右カラム側が h3 まで出せるのは、貼り付いたまま現在地に
 * 合わせて開き閉じできるからで、流れの中に置いた目次が同じことをすると、本編に
 * 入る前に画面が目次で埋まる。
 *
 * 中身は文脈から取る。差し込む印は hast の要素で、属性に書ける値しか運べないため。
 */
export function InlineTableOfContents(): React.JSX.Element | null {
  const { t } = useTranslation();
  const headings = use(TocHeadingsContext);

  const sections = headings.filter((heading) => heading.level === 2);
  if (sections.length < MIN_SECTIONS) return null;

  return (
    <nav className="inline-toc lg:hidden" aria-label={t("articles.toc")}>
      {/* 見出しを添える。本文の流れに置くので、字の並びだけでは何の一覧か読めない。 */}
      <p className="inline-toc-heading">{t("articles.toc")}</p>
      <ul className="inline-toc-list">
        {sections.map((section) => (
          <li key={section.id}>
            {/*
              素の <a href="#..."> だと ScrollRestoration がブラウザのハッシュ
              ジャンプを打ち消してスクロールしない。Link で React Router に
              ハッシュ遷移として扱わせる (右カラムの目次と同じ)。
            */}
            <Link to={`#${section.id}`} className="inline-toc-link press-control">
              {section.text}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
