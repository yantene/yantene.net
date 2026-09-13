import { useTranslation } from "react-i18next";

interface ComingSoonProps {
  /** ページの名前。ヘッダーのナビに出ている字と揃える。 */
  readonly heading: string;
  /** ここに何が置かれるのか。空手で帰さないための一文。 */
  readonly description: string;
}

/**
 * まだ中身の無いページ。
 *
 * ヘッダーのナビには `/about` `/notes` `/slides` を並べてある。行き先が 404 だと
 * 「壊れている」に見えるので、**何が置かれる場所なのか**だけを置いておく。
 *
 * 「戻る」導線はここに持たない。ヘッダーが全ページに出ていて、そこから行ける先は
 * この文章のすぐ上に並んでいる。同じものを二度出すと、行き止まりに見える。
 */
export function ComingSoon({ heading, description }: ComingSoonProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <p className="rounded-full border border-border px-3 py-1 text-xs font-bold tracking-wide text-muted-foreground">
        {t("comingSoon.badge")}
      </p>
      <h1 className="text-3xl font-bold">{heading}</h1>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}
