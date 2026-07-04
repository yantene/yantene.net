import { withThemeByDataAttribute } from "@storybook/addon-themes";
import type { Preview, Renderer } from "@storybook/react";
import i18next from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
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
    (Story) => (
      <I18nextProvider i18n={i18nInstance}>
        <Story />
      </I18nextProvider>
    ),
    withThemeByDataAttribute<Renderer>({
      themes: {
        light: "light",
        dark: "dark",
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
  },
};

export default preview;
