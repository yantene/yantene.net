# 開発フロー

```
Issue 作成 → ブランチ作成 → 実装・コミット → PR 作成 → レビュー → main マージ → staging 自動デプロイ → pnpm run release → production デプロイ
```

## マージ方式

Pull Request は squash merge で main にマージする。個々のコミットメッセージは
Conventional Commits 形式でなくてよいが、PR タイトルは必ず Conventional Commits に準拠させる
(squash 後のコミットメッセージになるため)。

## コミット・PR タイトル規則

[Conventional Commits](https://www.conventionalcommits.org/) に準拠。

```
<type>(<scope>): <subject>
```

使用できる type: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

コミット前に必ず以下を実行すること。

```bash
pnpm run lint:fix && pnpm run format:fix && pnpm run typecheck
```

## ブランチ命名規則

```
issue-{number}/{description}
```

例: `issue-3/fix-custom-domains`

Claude Code on the Web の場合は `claude/issue-{number}-{description}` 形式も許可。

## 課題管理 (GitHub Issues)

課題管理は **GitHub Issues** で行う。新規タスクは Issue として起票し、ブランチ・PR と紐付けて進める。

- Issue 起票・更新は `gh` CLI または GitHub Web UI を使う。
- 複数サブタスクを束ねたい場合は、本体 Issue にチェックボックスで列挙し、各サブタスクごとに
  別 Issue / 別 PR に切り出す。
- **ブランチは Issue 作成後に切ること。** ブランチ名に Issue 番号が必要なため、番号確定前に
  ブランチを切ると命名規則 (`issue-{number}/...`) に違反する。

## PR のライフサイクル管理

**PR を作成しただけで作業完了としない。** 作成後は以下を必ず満たしてからマージする。

1. **CI 全チェック pass** — 失敗したジョブは原因を調査・修正して再 push する。詳細は
   @.claude/rules/ci-cd.md の「PR で走るチェック」を参照。
2. **レビュー指摘の解消** — レビューコメントに対応し、スレッドを resolve してからマージする。

CI チェック待ちで不要な `sleep` を挟まないこと。`gh pr checks --watch` が自動でポーリングする。
ジョブの開始が遅い場合も、PR の close/reopen や再作成で解決しようとしないこと (キューに
不要なジョブが増えるだけで逆効果になる)。`gh run watch` / `gh pr checks --watch` で待つ。

## Push 前のローカルレビュー

CI とレビューの往復を減らすため、push 前にローカルで検証・レビューを済ませる。

```bash
pnpm run check   # lint + format + typecheck をまとめて検証
```

加えて、変更差分に対して `/code-review` を実行し、critical な指摘があれば修正してから
commit / push する。
