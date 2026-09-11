import { use } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { TocHeadingsContext } from "./toc-context";

/** これ未満の見出し数なら目次を出さない (右カラムの目次と揃える)。 */
const MIN_HEADINGS = 2;

/**
 * 本文に差し込む目次。最初の h2 の直前に置かれる (mdast-renderer.tsx が差し込む)。
 *
 * 右カラムの目次 (table-of-contents.tsx) が出ない幅のための代わり。同じものを縦に
 * 積むのではなく、畳んだ姿を既定にして本文の流れを切らないようにしてある。読み始め
 * の人には要らないもので、開くのは道に迷ってからでよい。
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

  if (headings.length < MIN_HEADINGS) return null;

  const sections = headings.filter((heading) => heading.level === 2);
  if (sections.length === 0) return null;

  return (
    <details className="inline-toc lg:hidden">
      <summary className="inline-toc-summary press-control">{t("articles.toc")}</summary>
      {/*
        nav を details の中に置く。閉じている間は中身が描かれないので、目次として
        読み上げに現れるのは開いたときだけになる。
      */}
      <nav aria-label={t("articles.toc")}>
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
    </details>
  );
}
