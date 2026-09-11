import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { useEnteredBody } from "./use-entered-body";
import type { TocHeading } from "~/backend/handlers/articles/toc-headings";
import { sectionOf, toSections } from "~/frontend/components/toc/sections";
import { useActiveHeading } from "~/frontend/components/toc/use-active-heading";

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
 * 一覧を抱えているのは、#442 の差し込み目次が記事の頭にしか無いため。読み進めた後は
 * 戻らないと目次に触れられないので、どこからでも構造へ帰れる入口をここが兼ねる。
 *
 * 出るのは JS が動く環境だけ。何も出なくても記事は読めるので、落とし所として許す。
 */
export function CurrentSection({ headings }: CurrentSectionProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const [isOpen, setOpen] = useState(false);

  const sections = toSections(headings);
  const activeId = useActiveHeading(headings);
  /*
   * 見張るのは最初の「節」であって最初の見出しではない。h3 から書き始めた記事では
   * toSections が h3 でセクションを開くので、そちらが起点になる。
   */
  const hasEntered = useEnteredBody(sections[0]?.heading.id ?? "");

  const current = sectionOf(sections, activeId);
  // 節が 1 つしかない記事では名前を出しても行き先が無い。出さない。
  if (sections.length < 2 || current === undefined || !hasEntered) return null;

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
      */}
      {isOpen && (
        <ul className="current-section-list">
          {sections.map((section) => (
            <li key={section.heading.id}>
              {/*
                素の <a href="#..."> だと ScrollRestoration がブラウザのハッシュ
                ジャンプを打ち消してスクロールしない。Link で Router に渡す。
              */}
              <Link
                to={`#${section.heading.id}`}
                className={`current-section-link press-control${
                  section.heading.id === current.heading.id ? " current-section-link-active" : ""
                }`}
                onClick={() => {
                  setOpen(false);
                }}
              >
                {section.heading.text}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
