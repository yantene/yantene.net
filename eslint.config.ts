import path from "node:path";
import { fileURLToPath } from "node:url";
import { includeIgnoreFile } from "@eslint/compat";
import js from "@eslint/js";
import prettierConfig from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import";
import tseslint from "typescript-eslint";
import type { Linter } from "eslint";

const filename: string = fileURLToPath(import.meta.url);
const dirname: string = path.dirname(filename);
const gitignorePath: string = path.resolve(dirname, ".gitignore");

const config: Linter.Config[] = [
  // .gitignore の内容を使用して ignore する
  includeIgnoreFile(gitignorePath),

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
        { allowString: true, allowNumber: false, allowNullableObject: true },
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

  // テストファイル用の設定
  {
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-magic-numbers": "off",
    },
  },

  // Prettier との競合を回避
  prettierConfig,
];

export default config;
