import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../app/frontend/**/*.stories.@(ts|tsx)"],

  addons: ["@storybook/addon-themes"],

  framework: "@storybook/react-vite",

  core: {
    builder: {
      name: "@storybook/builder-vite",
      options: {
        viteConfigPath: ".storybook/vite.config.ts",
      },
    },
  },
};

export default config;
