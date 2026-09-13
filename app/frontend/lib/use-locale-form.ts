import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";
import { defaultLocale, isSupportedLocale, type SupportedLocale } from "~/lib/i18n/locale";

/**
 * 表示する言語を選ぶフォームの中身のうち、**見た目に関わらない部分**。
 *
 * 帯 (LocaleMenu) とドロワー (LocaleSwitch) で姿は違うが、いま選ばれているのがどれかと、
 * 選んだ後にどこへ帰るかは同じでなければならない。書き写すと、画面の幅によって
 * 帰り先が違う、というような壊れ方をする。
 *
 * 姿のほうは分けたままにしてある。真偽値の prop で切り替えると、呼び出し側から何が
 * 出るのか読めなくなるため (rules/architecture.md)。
 */
export function useLocaleForm(): {
  /** いま選ばれている言語。読めない値は既定へ倒す。 */
  readonly current: SupportedLocale;
  /** 選んだ後の帰り先。 */
  readonly returnTo: string;
} {
  const { i18n } = useTranslation();
  const location = useLocation();

  /*
   * i18next の言語は "ja-JP" のような綴りにはならない (決めるのは resolve-locale で、
   * 返るのは SupportedLocale だけ)。それでも読めない値に備えて既定へ倒す。ここで
   * 落ちると、全ページのヘッダーが落ちる。
   */
  const current = isSupportedLocale(i18n.language) ? i18n.language : defaultLocale;

  /*
   * 帰り先。クエリは残す (検索結果を見たまま言語だけ変えられるように)。ハッシュは
   * 送れない — ブラウザがサーバーへ送らないので、そもそもここに入ってこない。
   */
  const returnTo = `${location.pathname}${location.search}`;

  return { current, returnTo };
}
