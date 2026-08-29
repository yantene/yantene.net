import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type PluginOption, type UserConfig } from "vite";
import svgr from "vite-plugin-svgr";

/**
 * SVG を React コンポーネントとしてインライン展開する (`import X from "./x.svg?react"`)。
 *
 * `<img src>` ではなくインライン展開する理由は 2 つ。外部 SVG には文書のスタイルが
 * 届かないため、街並みの `currentColor` が効かず、歩行者のパーツを CSS で回すこともできない。
 *
 * Storybook 側の vite 設定 (`.storybook/vite.config.ts`) からも参照する。設定が
 * 食い違うと Storybook でだけ SVG の見え方が変わるため、定義はここ 1 か所に置く。
 */
export function svgrPlugin(): PluginOption {
  return svgr({
    svgrOptions: {
      svgoConfig: {
        plugins: [
          {
            name: "preset-default",
            params: {
              overrides: {
                // 歩行者のパーツ (#leg-front など) を CSS が id で名指しする。
                // cleanupIds に潰されるとアニメーションが丸ごと効かなくなる。
                cleanupIds: false,
                // viewBox は素材を差し替えるときの契約なので消させない。
                removeViewBox: false,
              },
            },
          },
        ],
      },
    },
  });
}

/*
 * Oxlint の設定 (旧 eslint.config.ts)。
 *
 * 型を明示しているのは、この大きさのリテラルを defineConfig に直接渡すと
 * tsc が "Excessive stack depth comparing types" で落ちるため。
 */
const LINT_CONFIG = {
  plugins: ["typescript", "unicorn", "oxc", "react", "import", "promise", "jsx-a11y", "vitest"],
  categories: {
    correctness: "error",
    suspicious: "error",
    perf: "error",
  },
  ignorePatterns: [
    ".claude/worktrees/**",
    "worker-configuration.d.ts",
    "app/frontend/pages.gen.ts",
    "build/**",
    "dist/**",
    ".storybook/*.ts",
    ".storybook/*.tsx",
  ],
  /*
   * typeAware は型を見るルール (no-floating-promises など) に要る。
   * typeCheck (TS の診断まで oxlint に出させる実験的な機能) は入れない。
   * `pnpm run typecheck` の tsc -b と重複するうえ、この設定リテラル自体で
   * 「Excessive stack depth」を起こす。
   */
  options: {
    typeAware: true,
    typeCheck: false,
  },
  rules: {
    "typescript/no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      },
    ],
    "typescript/consistent-type-imports": [
      "error",
      {
        prefer: "type-imports",
        fixStyle: "inline-type-imports",
      },
    ],
    "typescript/no-import-type-side-effects": "error",
    "typescript/no-confusing-void-expression": [
      "error",
      {
        ignoreArrowShorthand: true,
      },
    ],
    "typescript/prefer-readonly": "error",
    "typescript/explicit-function-return-type": [
      "error",
      {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
        allowHigherOrderFunctions: true,
        allowDirectConstAssertionInArrowFunctions: true,
        allowIIFEs: true,
      },
    ],
    "typescript/strict-boolean-expressions": [
      "error",
      {
        allowString: true,
        allowNullableString: true,
        allowNumber: false,
        allowNullableObject: true,
      },
    ],
    "typescript/no-floating-promises": "error",
    "typescript/no-misused-promises": "error",
    "typescript/require-await": "error",
    "import/no-duplicates": "error",

    "typescript/no-unsafe-type-assertion": "off",
    "typescript/consistent-return": "off",
    "vitest/require-mock-type-parameters": "off",
    "vitest/require-to-throw-message": "off",
    "no-await-in-loop": "off",
    "no-shadow": "off",
    "preserve-caught-error": "off",
    "oxc/no-map-spread": "off",
    "import/no-unassigned-import": "off",
    "import/no-named-as-default": "off",
    "import/no-named-as-default-member": "off",
    "jsx-a11y/prefer-tag-over-role": "off",
    "jsx-a11y/control-has-associated-label": "off",
    "react/iframe-missing-sandbox": "off",
    "unicorn/filename-case": [
      "error",
      {
        cases: {
          camelCase: true,
          pascalCase: true,
          kebabCase: true,
        },
      },
    ],
    "react/react-in-jsx-scope": "off",
    "unicorn/no-null": "off",
  },
  overrides: [
    {
      files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
      rules: {
        "typescript/strict-boolean-expressions": "off",
        "typescript/explicit-function-return-type": "off",
        "typescript/no-floating-promises": "off",
        "typescript/no-misused-promises": "off",
        "typescript/require-await": "off",
        "typescript/no-confusing-void-expression": "off",
        "typescript/prefer-readonly": "off",
      },
    },
    {
      files: ["**/*.test.ts", "**/*.test.tsx"],
      rules: {
        "typescript/require-await": "off",
        "typescript/no-magic-numbers": "off",
        "typescript/no-unsafe-assignment": "off",
        "typescript/no-unsafe-member-access": "off",
        "typescript/unbound-method": "off",
        "unicorn/consistent-function-scoping": "off",
        "unicorn/max-nested-calls": "off",
      },
    },
    {
      files: ["**/*.stories.ts", "**/*.stories.tsx"],
      rules: {
        "typescript/require-await": "off",
        "typescript/no-magic-numbers": "off",
        "typescript/no-unsafe-assignment": "off",
        "typescript/no-unsafe-member-access": "off",
        "typescript/no-confusing-void-expression": "off",
        "unicorn/consistent-function-scoping": "off",
      },
    },
    {
      files: ["public/sw.js"],
      rules: {
        "unicorn/prefer-global-this": "off",
      },
    },
    {
      files: [
        "app/frontend/components/**/*.ts",
        "app/frontend/components/**/*.tsx",
        "app/frontend/layouts/**/*.ts",
        "app/frontend/layouts/**/*.tsx",
      ],
      rules: {
        "unicorn/filename-case": [
          "error",
          {
            cases: {
              kebabCase: true,
            },
          },
        ],
      },
    },
  ],
};

const viteConfig = defineConfig({
  // tsconfig の paths (~/* → app/*) を Vite に解決させる (Vite 8 のネイティブ機能)。
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    svgrPlugin(),
    reactRouter(),
  ],
});

/*
 * Oxlint の設定 (旧 eslint.config.ts) を足して出す。
 *
 * defineConfig の引数に直接書かないのは、vite-plus が vite のフォーク
 * (@voidzero-dev/vite-plus-core) を使っており、本家 vite の型で書いたプラグイン配列と
 * 突き合わせると tsc が "Excessive stack depth comparing types" で落ちるため。
 * 実行時に読まれるのは同じ 1 つのオブジェクトなので、振る舞いは変わらない。
 *
 * ⚠️ Oxlint は知らないルール名を、設定ファイル経由なら**エラーにする**が、
 * CLI の -D では黙って無視する。ルールを足したら違反コードを書いて発火を確かめること。
 */
const config: UserConfig & { readonly lint: typeof LINT_CONFIG } = {
  ...viteConfig,
  lint: LINT_CONFIG,
};

export default config;
