import path from "node:path";
import { fileURLToPath } from "node:url";
import { includeIgnoreFile } from "@eslint/compat";
import js from "@eslint/js";
import prettierConfig from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import";
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
import vitest from "eslint-plugin-vitest";
import tseslint from "typescript-eslint";
import type { Linter } from "eslint";

const filename: string = fileURLToPath(import.meta.url);
const dirname: string = path.dirname(filename);
const gitignorePath: string = path.resolve(dirname, ".gitignore");

// Note: 一部のプラグイン（特に react-hooks）の型定義が ESLint 9 flat config と
// 完全に互換性がないため、型アサーションを使用しています
const config = [
  // .gitignore の内容を使用して ignore する
  includeIgnoreFile(gitignorePath),

  // Storybook 設定ファイルを ESLint の対象外にする
  { ignores: [".storybook/*.ts"] },

  // JavaScript の推奨設定
  js.configs.recommended,

  // TypeScript の厳格な型チェック設定（型情報を使用）
  ...tseslint.configs.strictTypeChecked.map((config) => ({
    ...config,
    files: ["**/*.ts", "**/*.tsx"],
  })),

  // プロジェクト固有のカスタマイズ
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      import: importPlugin,
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: dirname,
      },
    },
    settings: {
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: "./tsconfig.json",
        },
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      // 命名規則（具体的なルールを先に、一般的なルールを後に配置）
      "@typescript-eslint/naming-convention": [
        "error",
        // boolean 変数は is/has などのプレフィックスを強制（プレフィックス後は PascalCase）
        {
          selector: "variable",
          types: ["boolean"],
          format: ["PascalCase"],
          prefix: ["is", "has", "should", "can", "will", "did"],
        },
        // 定数（string/number 型）は UPPER_CASE または camelCase
        {
          selector: "variable",
          modifiers: ["const"],
          types: ["string", "number"],
          format: ["UPPER_CASE", "camelCase"],
        },
        // 変数は camelCase
        {
          selector: "variable",
          format: ["camelCase"],
          leadingUnderscore: "allow",
        },
        // 関数は camelCase または PascalCase（React コンポーネント対応）
        {
          selector: "function",
          format: ["camelCase", "PascalCase"],
          leadingUnderscore: "allow",
        },
        // 型・インターフェースは PascalCase
        {
          selector: ["typeLike"],
          format: ["PascalCase"],
        },
        // プライベートクラスメンバーは camelCase（先頭アンダースコア許可）
        {
          selector: "classProperty",
          modifiers: ["private"],
          format: ["camelCase"],
          leadingUnderscore: "allow",
        },
      ],

      // 非同期処理の厳格化
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/require-await": "error",

      // 型安全性の厳格化
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

      // インポート管理
      "import/no-duplicates": "error",
      "import/order": [
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

      // コード品質
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-import-type-side-effects": "error",
      "@typescript-eslint/no-confusing-void-expression": [
        "error",
        { ignoreArrowShorthand: true },
      ],
      "@typescript-eslint/prefer-readonly": "error",
    },
  },

  // React の設定
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
      // React の推奨ルール
      ...react.configs.recommended.rules,
      ...react.configs["jsx-runtime"].rules,

      // React Hooks のルール
      ...reactHooks.configs.recommended.rules,

      // React Refresh のルール
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],

      // アクセシビリティのルール（推奨設定）
      ...jsxA11y.flatConfigs.recommended.rules,

      // React 固有の調整
      "react/prop-types": "off", // TypeScript を使用するため不要
      "react/react-in-jsx-scope": "off", // React 17+ では不要
    },
  },

  // React Router のルートファイルと root.tsx では関数エクスポートを許可
  {
    files: ["**/routes/**/*.tsx", "**/root.tsx"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },

  // コード品質・バグ検出のルール
  {
    plugins: {
      unicorn,
      sonarjs,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      promise: promisePlugin,
    },
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    rules: {
      // Unicorn の推奨ルール（一部調整）
      ...unicorn.configs.recommended.rules,
      "unicorn/prevent-abbreviations": "off", // 略語を許可
      "unicorn/no-null": "off", // null の使用を許可
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

      // SonarJS の推奨ルール
      ...sonarjs.configs.recommended.rules,

      // Promise の推奨ルール
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      ...promisePlugin.configs.recommended.rules,
    },
  },

  // セキュリティのルール
  {
    plugins: {
      security,
      "no-secrets": noSecrets,
    },
    rules: {
      // Security の推奨ルール
      ...security.configs.recommended.rules,

      // シークレット検出
      "no-secrets/no-secrets": "error",
    },
  },

  // Vitest テストファイルの設定（最後に配置してルールを上書き）
  {
    files: ["**/*.test.ts", "**/*.test.tsx"],
    plugins: {
      vitest,
    },
    rules: {
      ...vitest.configs.recommended.rules,

      // テストファイルでは緩和するルール
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-magic-numbers": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/unbound-method": "off", // モック関数の分離代入を許可
      "unicorn/consistent-function-scoping": "off", // テストケース内でのモック定義を許可
    },
  },

  // Storybook ストーリーファイルの設定
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

  // Prettier との競合を回避
  prettierConfig,
] as Linter.Config[];

export default config;
