import type { Linter } from "eslint";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";
import { includeIgnoreFile } from "@eslint/compat";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename: string = fileURLToPath(import.meta.url);
const __dirname: string = path.dirname(__filename);
const gitignorePath: string = path.resolve(__dirname, ".gitignore");

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
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      // 非同期処理の厳格化

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
      "@typescript-eslint/no-magic-numbers": [
        "error",
        {
          ignore: [0, 1, -1],
          ignoreArrayIndexes: true,
          ignoreDefaultValues: true,
          ignoreEnums: true,
          ignoreReadonlyClassProperties: true,
        },
      ],
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
