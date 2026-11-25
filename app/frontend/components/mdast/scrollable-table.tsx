import { useTranslation } from "react-i18next";

/**
 * 本文の表 (table) 差し替え: 横にはみ出す表を、表の中だけで横に送れる器に収める。
 *
 * 列の多い表は携帯の幅に収まらない。器が無いと、はみ出した列がページごと横に送られ、
 * 本文の行まで画面の外へずれる。
 *
 * 器は `tabIndex={0}` でキーボードの焦点を受ける。矢印キーで横に送るには、焦点が器に
 * 乗っている必要がある (中にリンクの無い表では、ほかに焦点を受けるものが無い)。
 * 焦点を受けるものには名前が要るので、`role="region"` と名前を付ける。GFM の表は
 * 見出し (caption) を持たないので、名前は「表」で揃える。
 */
export function ScrollableTable(
  props: Readonly<React.ComponentPropsWithoutRef<"table">>,
): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div
      className="mdast-table-scroll"
      role="region"
      aria-label={t("prose.tableLabel")}
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- 横に送れる器は、焦点を受けないとキーボードで送れない (WCAG 2.1.1)
      tabIndex={0}
    >
      <table {...props} />
    </div>
  );
}
