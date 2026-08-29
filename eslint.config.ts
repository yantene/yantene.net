import path from "node:path";
import { includeIgnoreFile } from "@eslint/config-helpers";
import js from "@eslint/js";
import vitest from "@vitest/eslint-plugin";
import prettierConfig from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import-x";
import jsxA11y from "eslint-plugin-jsx-a11y";
import noSecrets from "eslint-plugin-no-secrets";
// @ts-expect-error - no type definitions available
import promisePlugin from "eslint-plugin-promise";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import security from "eslint-plugin-security";
import sonarjs from "eslint-plugin-sonarjs";
import unicorn from "eslint-plugin-unicorn";
import tseslint from "typescript-eslint";
import type { Linter } from "eslint";

const dirname: string = import.meta.dirname;
const gitignorePath: string = path.resolve(dirname, ".gitignore");

const config = [
  includeIgnoreFile(gitignorePath),

  {
    ignores: [".storybook/*.ts", ".storybook/*.tsx"],
  },

  {
    ignores: [
      ".claude/worktrees/**",
      "worker-configuration.d.ts",
      "app/frontend/pages.gen.ts",
      "dist/**",
    ],
  },

  js.configs.recommended,

  ...tseslint.configs.strictTypeChecked.map((config) => ({
    ...config,
    files: ["**/*.ts", "**/*.tsx"],
  })),

  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      "import-x": importPlugin,
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: "variable",
          types: ["boolean"],
          format: ["PascalCase"],
          prefix: ["is", "has", "should", "can", "will", "did"],
        },
        {
          selector: "variable",
          modifiers: ["const"],
          types: ["string", "number"],
          format: ["UPPER_CASE", "camelCase"],
        },
        {
          selector: "variable",
          format: ["camelCase", "PascalCase"],
          leadingUnderscore: "allow",
        },
        {
          selector: "function",
          format: ["camelCase", "PascalCase"],
          leadingUnderscore: "allow",
        },
        {
          selector: ["typeLike"],
          format: ["PascalCase"],
        },
        {
          selector: "classProperty",
          modifiers: ["private"],
          format: ["camelCase"],
          leadingUnderscore: "allow",
        },
      ],

      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/require-await": "error",

      "@typescript-eslint/strict-boolean-expressions": [
        "error",
        {
          allowString: true,
          allowNullableString: true,
          allowNumber: false,
          allowNullableObject: true,
        },
      ],
      "@typescript-eslint/explicit-function-return-type": [
        "error",
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true,
          allowDirectConstAssertionInArrowFunctions: true,
          allowIIFEs: true,
        },
      ],

      "import-x/no-duplicates": "error",
      "import-x/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
            "object",
            "type",
          ],
          "newlines-between": "never",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],

      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-import-type-side-effects": "error",
      "@typescript-eslint/no-confusing-void-expression": ["error", { ignoreArrowShorthand: true }],
      "@typescript-eslint/prefer-readonly": "error",
    },
  },

  {
    files: ["**/*.jsx", "**/*.tsx"],
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "jsx-a11y": jsxA11y,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs["jsx-runtime"].rules,
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      ...jsxA11y.flatConfigs.recommended.rules,
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
    },
  },

  // React Router のルートモジュールは loader / meta / links / ErrorBoundary を
  // コンポーネントと同じファイルから export する規約なので、
  // only-export-components の警告対象から外す。
  {
    files: [
      "app/frontend/routes/**/*.tsx",
      "app/frontend/root.tsx",
      "app/frontend/layouts/**/*.tsx",
      "app/frontend/entry.client.tsx",
      "app/frontend/entry.server.tsx",
    ],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },

  {
    plugins: {
      unicorn,
      sonarjs,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      promise: promisePlugin,
    },
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    rules: {
      ...unicorn.configs.recommended.rules,
      "unicorn/prevent-abbreviations": "off",
      // prevent-abbreviations と同じく、略語 (db, stmt, req 等) の強制展開は採用しない。
      // v70 で追加された name-replacements も同方針で off にする。
      "unicorn/name-replacements": "off",
      "unicorn/no-null": "off",
      // eslint-plugin-unicorn v70 の recommended は本ルールを severity のみ ("error") で
      // 設定するが、その oneOf スキーマ (minItems:0 のタプル分岐) を eslint 9.39.4 の
      // バリデータが空オプションで弾く。既定挙動 ("always") を明示してスキーマを満たす。
      "unicorn/logical-assignment-operators": ["error", "always"],

      // Hono の app は module トップで合成する (Composition Root)。
      // app.use(...) / app.route(...) のトップレベル副作用は本構成では意図的。
      "unicorn/no-top-level-side-effects": "off",
      // drizzle のクエリビルダ `.values(...)` を Array.prototype.values と
      // 誤認する false positive。戻り値は await で消費しており問題ない。
      "unicorn/no-unused-array-method-return": "off",
      // public を先・private を後に並べる方針 (newspaper ordering) を採用しており、
      // private-first を強制するこのルールとは相容れない。
      "unicorn/consistent-class-member-order": "off",

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

      // @ts-expect-error - sonarjs configs type is possibly undefined
      ...sonarjs.configs.recommended.rules,

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      ...promisePlugin.configs.recommended.rules,
    },
  },

  {
    plugins: {
      security,
      "no-secrets": noSecrets,
    },
    rules: {
      ...security.configs.recommended.rules,
      "no-secrets/no-secrets": "error",
    },
  },

  {
    files: ["**/*.test.ts", "**/*.test.tsx"],
    plugins: {
      vitest,
    },
    rules: {
      ...vitest.configs.recommended.rules,
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-magic-numbers": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/unbound-method": "off",
      "unicorn/consistent-function-scoping": "off",
      // テストの fixture / assertion 構築では呼び出しのネストが深くなりがちで、
      // 無理に分解すると可読性が下がる。テストに限り深さ制限を外す。
      "unicorn/max-nested-calls": "off",
      "sonarjs/no-clear-text-protocols": "off",
    },
  },

  {
    files: ["**/*.stories.ts", "**/*.stories.tsx"],
    rules: {
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-magic-numbers": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/naming-convention": "off",
      "@typescript-eslint/no-confusing-void-expression": "off",
      "unicorn/consistent-function-scoping": "off",
      "react-refresh/only-export-components": "off",
    },
  },

  /*
   * Service Worker は普通のブラウザ環境ではない。self / caches / clients は
   * Worker のスコープに生えているもので、globalThis へ寄せると読み手が
   * 「どの世界の話か」を掴みづらくなるため、慣用に合わせて self のままにする。
   */
  {
    files: ["public/sw.js"],
    languageOptions: {
      globals: {
        caches: "readonly",
        clients: "readonly",
        fetch: "readonly",
        registration: "readonly",
        Response: "readonly",
        self: "readonly",
        URL: "readonly",
      },
    },
    rules: {
      "unicorn/prefer-global-this": "off",
      // install の中では waitUntil に Promise をそのまま渡す必要がある。
      "unicorn/prefer-await": "off",
    },
  },

  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        AbortSignal: "readonly",
        console: "readonly",
        fetch: "readonly",
        process: "readonly",
        URL: "readonly",
      },
    },
  },

  // フロントエンド配下のファイルは kebab-case のみ許可
  // (case-insensitive ファイルシステムでの衝突防止 + Linux CI で壊れるパターン防止)
  // ルートモジュール (app/frontend/routes/) は動的セグメントをドットで区切る
  // (notes.$slug.tsx) ため対象外にしてある。
  {
    files: ["app/frontend/components/**/*.{ts,tsx}", "app/frontend/layouts/**/*.{ts,tsx}"],
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

  // CSP (style-src 'self') はブラウザに inline style 属性を丸ごと無視させる。
  // style で渡した値は本番で必ず消えるので、見た目は静的な CSS / クラスで表現する。
  // 過去に Celestim の CSS 変数とタグクラウドの文字サイズがこれで消えている (#78, #80)。
  {
    files: ["app/frontend/**/*.tsx"],
    ignores: ["app/frontend/**/*.stories.tsx"],
    rules: {
      "react/forbid-dom-props": [
        "error",
        {
          forbid: [
            {
              propName: "style",
              message:
                "CSP (style-src 'self') が inline style 属性を落とすため本番で効かない。CSS / クラスで表現すること。",
            },
          ],
        },
      ],
    },
  },

  prettierConfig,
] as Linter.Config[];

export default config;
