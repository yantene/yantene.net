import { withThemeByDataAttribute } from "@storybook/addon-themes";
import type { Preview, Renderer } from "@storybook/react";
import i18next from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { MemoryRouter } from "react-router";
import { INITIAL_VIEWPORTS, MINIMAL_VIEWPORTS } from "storybook/viewport";
import resources from "../app/lib/i18n/locales";
import "../app/frontend/app.css";

const i18nInstance = i18next.createInstance();
void i18nInstance.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  resources,
  interpolation: { escapeValue: false },
});

const preview: Preview = {
  decorators: [
    /*
     * Header / ArticleTimeline / TableOfContents などが react-router の Link を使うため、
     * Router コンテキストを与える。
     *
     * どこを見ているかは `initialEntries` で差し替えられる。現在地の印 (SiteNav の
     * aria-current) のように、「いま開いている URL」で見え方が変わるものがあるため。
     * **入れ子にはできない** ので (React Router は Router の二重化を例外にする)、
     * 差し替えはここ 1 か所で行う。
     *
     * ```ts
     * export const Story = { parameters: { initialEntries: ["/articles/foo"] } };
     * ```
     */
    (Story, context) => (
      <MemoryRouter initialEntries={context.parameters.initialEntries ?? ["/"]}>
        <I18nextProvider i18n={i18nInstance}>
          <Story />
        </I18nextProvider>
      </MemoryRouter>
    ),
    withThemeByDataAttribute<Renderer>({
      themes: {
        light: "light",
      },
      defaultTheme: "light",
      attributeName: "data-theme",
    }),
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /date$/i,
      },
    },
    /*
     * 画面幅の選択肢を登録する。既定は responsive のままなので、指定したストーリーだけが
     * 狭い幅で描かれる。Tailwind の sm: は viewport の media query なので、装飾の div を
     * 細くしても出し分けは再現できず、iframe ごと狭める必要がある。
     *
     * **2 つとも登録する。** 実機の名前 (`iphonex` など) は INITIAL に、素の名前
     * (`mobile1` / `tablet` / `desktop`) は MINIMAL にしかない。片方だけだと、
     * もう片方の名前を指したストーリーは**黙って既定の幅で描かれる** — 狭い幅の
     * 出し分けを見張るつもりのストーリーが、何も見張らなくなる。
     */
    viewport: { options: { ...MINIMAL_VIEWPORTS, ...INITIAL_VIEWPORTS } },
  },
};

export default preview;
