import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";
import {
  defaultLocale,
  isSupportedLocale,
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
 * 表示する言語の切り替え。
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
  const { t, i18n } = useTranslation();
  const location = useLocation();

  /*
   * i18next の言語は "ja-JP" のような綴りにはならない (決めるのは resolve-locale で、
   * 返るのは SupportedLocale だけ)。それでも読めない値に備えて既定へ倒す。ここで
   * 落ちると、全ページのヘッダーが落ちる。
   */
  const current = isSupportedLocale(i18n.language) ? i18n.language : defaultLocale;

  /*
   * 戻り先。クエリは残す (検索結果を見たまま言語だけ変えられるように)。ハッシュは
   * 送れない — ブラウザがサーバーへ送らないので、そもそもここに入ってこない。
   */
  const returnTo = `${location.pathname}${location.search}`;

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
