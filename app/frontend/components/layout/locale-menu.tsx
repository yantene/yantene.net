import { useId } from "react";
import { useTranslation } from "react-i18next";
import { HiOutlineGlobeAlt } from "react-icons/hi2";
import { useLocaleForm } from "~/frontend/lib/use-locale-form";
import {
  localeField,
  localeLabels,
  localePath,
  localeReturnToField,
  supportedLocales,
} from "~/lib/i18n/locale";

/**
 * 表示する言語の切り替え。帯には globe の絵だけを出し、選び場所は畳んでおく。
 *
 * **畳むのは、めったに触らない設定だから。** 一度選べば cookie に 1 年残るので、
 * 帯で常に場所を取らせる理由が無い。EN / JA を出したままにしていたときは、帯で
 * 2 番目に目立つものが「一度決めたらほとんど触らない設定」になっていた。
 *
 * **中身は素の `<form method="post">`。** React Router の `<Form>` ではなく生の
 * フォームを使うのは、JavaScript が動かない環境でも切り替わるようにするため。器も
 * Popover API (`popover="auto"` + `popovertarget`) で、開閉は属性だけで決まるので、
 * その環境でも開いて選べる。外押し・Esc で畳むこと、焦点を押し場所へ戻すこと、隣の
 * フィードと同時に開かないことはブラウザが持つ (FeedMenu と同じ作り)。送り先の `POST /locale` は Hono が
 * 受けて cookie を置き、元のページへ 303 で戻す (backend/handlers/locale.handler.ts)。
 *
 * 選んだ結果は次の描画に効く。ページ全体を読み直すので、`<html lang>` と meta と本文が
 * 必ず同じ言語で揃う。クライアント側だけで i18next の言語を差し替えると、loader が
 * 既に決めた値から組んだ meta だけが前の言語のまま残る。
 *
 * **いま選ばれている側も押せるままにしておく。** 無効にすると、cookie がまだ無い
 * (Accept-Language で決まっている) 読み手が、いま出ている言語を明示的に選べなくなる。
 */
export function LocaleMenu({ className = "" }: { readonly className?: string }): React.JSX.Element {
  const { t } = useTranslation();
  const panelId = useId();
  /* いま選ばれているものと帰り先は、ドロワーの LocaleSwitch と同じものを使う。 */
  const { current, returnTo } = useLocaleForm();

  return (
    <div className={`header-menu ${className}`}>
      {/* 名前と開閉の伝え方は FeedMenu と同じ (理由は feed-menu.tsx に書いてある)。 */}
      <button
        type="button"
        popoverTarget={panelId}
        aria-controls={panelId}
        className="header-menu-trigger locale-menu-trigger press-control"
        aria-label={t("locale.label")}
        title={t("locale.label")}
      >
        <HiOutlineGlobeAlt className="header-menu-icon" aria-hidden />
      </button>

      <div id={panelId} popover="auto" className="header-menu-panel locale-menu-panel">
        <p className="header-menu-title">{t("locale.label")}</p>
        <form method="post" action={localePath} aria-label={t("locale.label")}>
          <input type="hidden" name={localeReturnToField} value={returnTo} />
          <ul className="header-menu-list">
            {supportedLocales.map((locale) => (
              <li key={locale}>
                {/*
                  畳んだ先では略号 (EN / JA) ではなく言語の名前そのものを出す。帯に
                  2 つ並べていたときは幅のために略号にしていたが、板の中なら full の
                  名前が入る。**その言語の名前は、その言語で書く** ので lang を添える。
                */}
                <button
                  type="submit"
                  name={localeField}
                  value={locale}
                  lang={locale}
                  aria-current={locale === current ? "true" : undefined}
                  className="header-menu-item press-surface"
                >
                  {localeLabels[locale]}
                </button>
              </li>
            ))}
          </ul>
        </form>
      </div>
    </div>
  );
}
