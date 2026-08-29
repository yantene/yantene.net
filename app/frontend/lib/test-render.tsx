import { render, type RenderResult } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router";
import { beforeAll } from "vitest";
import type { i18n } from "i18next";
import type { SupportedLocale } from "~/lib/i18n/locale";
import { createI18nInstance } from "~/lib/i18n/init";

interface RenderOptions {
  /**
   * `MemoryRouter` で包むか。`<Link>` を含むものは包む必要がある。
   *
   * 自分で router を用意するとき (`createRoutesStub` を使うテスト) は `false`。
   * 二重に包むと、内側の router が外側の履歴を見に行って行き先が食い違う。
   */
  readonly router?: boolean;
}

/**
 * i18n を用意して React を描く。テストごとの下ごしらえを 1 か所に集める。
 *
 * 呼ぶのはテストファイルのトップレベル。`beforeAll` をここで登録するので、
 * describe の中で呼ぶとその describe にだけ効いてしまう。
 *
 * ```tsx
 * const renderWithI18n = withI18n("ja");
 *
 * it("...", () => {
 *   renderWithI18n(<Footer copyright={{ from: 2003, to: 2026 }} />);
 * });
 * ```
 *
 * インスタンスを入れ物 (`ref`) 越しに持つのは、`beforeAll` が非同期で、
 * トップレベル変数への代入がテスト本体より後になるため。
 */
export function withI18n(
  locale: SupportedLocale = "ja",
): (ui: React.ReactNode, options?: RenderOptions) => RenderResult {
  const ref: { current: i18n | undefined } = { current: undefined };

  beforeAll(async () => {
    ref.current = await createI18nInstance(locale);
  });

  return (ui, { router = true } = {}) => {
    const instance = ref.current;
    if (instance === undefined) throw new Error("i18n is not ready");

    const tree = <I18nextProvider i18n={instance}>{ui}</I18nextProvider>;
    return render(router ? <MemoryRouter>{tree}</MemoryRouter> : tree);
  };
}
