import { use } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { TocHeadingsContext } from "./toc-context";

/**
 * これ未満の節数なら目次を出さない。
 *
 * 数えるのは h2 だけ。見出しの総数で数えると、「h2 が 1 つ + h3 が 3 つ」の記事にも
 * 目次が出る。節が 1 つしかない記事の目次は、押せる場所が増えるだけで全体像を伝えない。
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
 * h3 も出す。字を下げて並べるだけで、右カラムのように開き閉じはしない。畳まない目次で
 * 階層まで出すと長くなるが、節の中に何があるかまで見えないと「この記事に何が書いてある
 * か」が読めないので、長さのほうを受け入れる。
 *
 * 出すかどうかは h2 の数で決める。h3 がいくつあっても、節が 1 つしかない記事に目次は
 * 要らない。
 *
 * 中身は文脈から取る。差し込む印は hast の要素で、属性に書ける値しか運べないため。
 */
export function InlineTableOfContents(): React.JSX.Element | null {
  const { t } = useTranslation();
  const headings = use(TocHeadingsContext);

  // 出し止めは節 (h2) の数で決める。並べるのは h3 を含む全部。
  const sectionCount = headings.filter((heading) => heading.level === 2).length;
  if (sectionCount < MIN_SECTIONS) return null;

  return (
    <nav className="inline-toc lg:hidden" aria-label={t("articles.toc")}>
      {/* 見出しを添える。本文の流れに置くので、字の並びだけでは何の一覧か読めない。 */}
      <p className="inline-toc-heading">{t("articles.toc")}</p>
      <ul className="inline-toc-list">
        {headings.map((heading) => (
          <li key={heading.id}>
            {/*
              素の <a href="#..."> だと ScrollRestoration がブラウザのハッシュ
              ジャンプを打ち消してスクロールしない。Link で React Router に
              ハッシュ遷移として扱わせる (右カラムの目次と同じ)。
            */}
            <Link
              to={`#${heading.id}`}
              className={`inline-toc-link press-control${
                heading.level === 3 ? " inline-toc-link-sub" : ""
              }`}
            >
              {heading.text}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
