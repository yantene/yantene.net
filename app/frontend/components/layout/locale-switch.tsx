import { useTranslation } from "react-i18next";
import { useLocaleForm } from "~/frontend/lib/use-locale-form";
import {
  localeAbbreviations,
  localeField,
  localeLabels,
  localePath,
  localeReturnToField,
  supportedLocales,
} from "~/lib/i18n/locale";

interface LocaleSwitchProps {
  /** 置き場所ごとの見た目の差 (帯の中・ドロワーの中) を呼ぶ側から足すための口。 */
  readonly className?: string;
}

/**
 * 表示する言語の切り替え — **ドロワー (狭い画面) に置く平らな姿。**
 *
 * 帯のほうは globe の絵から開く板になっている (LocaleMenu)。ドロワーは既に
 * `<details>` の中なので、そこで更に畳まず、2 つしかない選択肢を出したままにする。
 *
 * **素の `<form method="post">`。** React Router の `<Form>` ではなく生のフォームを使う
 * のは、JavaScript が動かない環境でも切り替わるようにするため。送り先の
 * `POST /locale` は Hono が受けて cookie を置き、元のページへ 303 で戻す
 * (backend/handlers/locale.handler.ts)。
 *
 * 選んだ結果は次の描画に効く。ページ全体を読み直すので、`<html lang>` と meta と
 * 本文が必ず同じ言語で揃う。クライアント側だけで i18next の言語を差し替えると、
 * loader が既に決めた値から組んだ meta だけが前の言語のまま残る。
 *
 * **いま選ばれている側も押せるままにしておく。** 無効にすると、cookie がまだ無い
 * (Accept-Language で決まっている) 読み手が、いま出ている言語を明示的に選べなくなる。
 */
export function LocaleSwitch({ className = "" }: LocaleSwitchProps): React.JSX.Element {
  const { t } = useTranslation();
  /* いま選ばれているものと帰り先は、帯の LocaleMenu と同じものを使う。 */
  const { current, returnTo } = useLocaleForm();

  return (
    <form
      method="post"
      action={localePath}
      className={`locale-switch ${className}`}
      aria-label={t("locale.label")}
    >
      <input type="hidden" name={localeReturnToField} value={returnTo} />
      {supportedLocales.map((locale) => (
        <button
          key={locale}
          type="submit"
          name={localeField}
          value={locale}
          lang={locale}
          /*
           * 見えるのは略号 (EN / JA) だが、読み上げに渡すのは言語の名前そのもの。
           * 2 文字の略号は音にすると何のことか分からない。
           */
          aria-label={localeLabels[locale]}
          aria-current={locale === current ? "true" : undefined}
          className="locale-switch-option press-control"
        >
          {localeAbbreviations[locale]}
        </button>
      ))}
    </form>
  );
}
