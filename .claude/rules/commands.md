# 開発コマンド

```bash
# 開発
pnpm dev              # 開発サーバー起動
pnpm test             # テスト watch mode
pnpm run test:run     # テスト 1 回実行

# コード品質
pnpm run lint         # ESLint チェック
pnpm run lint:fix     # ESLint 自動修正
pnpm run format       # Prettier チェック
pnpm run format:fix   # Prettier 自動修正
pnpm run typecheck    # TypeScript 型チェック
pnpm run fix          # lint:fix + format:fix (自動修正まとめ)
pnpm run check        # lint + format + typecheck (読取検証まとめ)

# DB マイグレーション
pnpm run db:generate --name create_users_table  # migration ファイル生成 (--name 必須)
pnpm run db:dev:migrate      # development (local) に適用
pnpm run db:dev:reset        # development の全テーブル削除 → 再適用
pnpm run db:staging:migrate  # staging (remote) に適用
pnpm run db:prod:migrate     # production (remote) に適用

# リリース
pnpm run release      # リリースタグ作成・GitHub Release 公開
```

## マイグレーションファイルの命名規則

drizzle-kit が自動生成する `0000_wealthy_vulture` のようなランダム名は**使わない**。
`db:generate` には必ず `--name` を付け、変更意図が伝わる名前にすること。

```bash
pnpm run db:generate --name create_users_table      # ✅ 意図が明確
pnpm run db:generate --name add_users_avatar_url
pnpm run db:generate                                # ❌ ランダム名になる
```

- 形式: `<連番>_<スネークケースの要約>`（連番は drizzle が自動付与）
- 動詞始まりで操作を表す: `create_*`, `add_*`, `drop_*`, `rename_*`, `alter_*`
- リネームが必要な場合は SQL ファイル名・`meta/_journal.json` の `tag`・適用済み
  環境の記録の 3 点を必ず一致させる（不一致だと再適用や検証で壊れる）
