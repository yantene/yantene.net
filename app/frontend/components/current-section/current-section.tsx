import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { useScrolledPast } from "./use-scrolled-past";
import type { TocHeading } from "~/backend/handlers/articles/toc-headings";
import { sectionOf, toSections } from "~/frontend/components/toc/sections";
import { useActiveHeading } from "~/frontend/components/toc/use-active-heading";

/**
 * 差し込み目次を指す選び方。これを通り過ぎたらバーが出る。
 *
 * 別のコンポーネントの class 名に依っている。位置ではなく「目次そのもの」を見張りたく、
 * 目次は本文の中 (MdastRenderer が差し込む) に居るので、DOM から引くしかない。
 */
const INLINE_TOC_SELECTOR = ".inline-toc";

interface CurrentSectionProps {
  /** サーバー側で抽出した見出し (rehype-slug と一致する id 付き)。 */
  readonly headings: readonly TocHeading[];
}

/**
 * いま読んでいる節の名前を、画面上端に出し続ける (携帯向け)。押すと節の一覧が開く。
 *
 * 見出しそのものを `position: sticky` にする形は採っていない。h2 は本文の直下に並んで
 * いるので、包含ブロックを区切らないまま貼り付けると次の h2 と重なる。区切るには hast を
 * セクションで包み直すことになり、見出しのパーマリンクと差し込み目次が両方壊れる。
 * 見出しは 45〜55px あり、ヘッダーと合わせると携帯の画面の 17% が読めなくなる。
 *
 * 一覧を抱えているのは、差し込み目次が記事の頭にしか無いため。読み進めた後は戻らないと
 * 目次に触れられないので、どこからでも構造へ帰れる入口をここが兼ねる。
 *
 * 出始めるのは、その差し込み目次を通り過ぎたとき。目次が画面から消えた時点でバーが
 * 代わりになる、という受け渡しにしてある。**目次の class 名 (.inline-toc) に依っている**
 * ので、あちらを改名したらここも直すこと。目次の出ない記事ではバーも出ない (代わりに
 * なるものが無いので、出しても一覧が空振りする)。
 *
 * 出るのは JS が動く環境だけ。何も出なくても記事は読めるので、落とし所として許す。
 */
export function CurrentSection({ headings }: CurrentSectionProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const [isOpen, setOpen] = useState(false);

  const sections = toSections(headings);
  const activeId = useActiveHeading(headings);
  const hasPassedToc = useScrolledPast(INLINE_TOC_SELECTOR);

  const current = sectionOf(sections, activeId);
  // 節が 1 つしかない記事では名前を出しても行き先が無い。出さない。
  if (sections.length < 2 || current === undefined || !hasPassedToc) return null;

  return (
    <nav className="current-section" aria-label={t("articles.toc")}>
      <button
        type="button"
        className="current-section-summary press-control"
        aria-expanded={isOpen}
        onClick={() => {
          setOpen((open) => !open);
        }}
      >
        <span className="current-section-name">{current.heading.text}</span>
        <span className="current-section-caret" aria-hidden="true" />
      </button>

      {/*
        開いている間だけ描く。閉じているものを CSS で隠すと、読み上げと Tab の順に
        行き先の無い項目が並ぶ。

        並びは差し込み目次と揃える。節だけだと、節の中のどこに何があるかが分からない。
      */}
      {isOpen && (
        <ul className="current-section-list">
          {headings.map((heading) => (
            <li key={heading.id}>
              {/*
                素の <a href="#..."> だと ScrollRestoration がブラウザのハッシュ
                ジャンプを打ち消してスクロールしない。Link で Router に渡す。
              */}
              <Link
                to={`#${heading.id}`}
                className={`current-section-link press-control${
                  heading.level === 3 ? " current-section-link-sub" : ""
                }${heading.id === current.heading.id ? " current-section-link-active" : ""}`}
                onClick={() => {
                  setOpen(false);
                }}
              >
                {heading.text}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
