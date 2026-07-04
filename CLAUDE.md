# CLAUDE.md

Cloudflare Workers + Hono + Inertia.js + React + Drizzle ORM で構成される Web アプリケーション。

> ⚠️ ステージング環境の BASIC 認証は絶対に削除しないこと。
> BASIC 認証はアプリケーション認証とは独立したレイヤーであり、常に有効にしておくこと。

@.claude/rules/development-workflow.md
@.claude/rules/commands.md
@.claude/rules/ci-cd.md
@.claude/rules/architecture.md
@.claude/rules/environments.md
@.claude/rules/adr.md

## アーキテクチャ決定の記録 (ADR)

アーキテクチャ的に重要な決定は `docs/adr/` に ADR として記録している。設計の背景・意図を知りたいとき、
また重要な設計判断を行うときはここを参照・更新すること。運用ルールは @.claude/rules/adr.md を参照。
