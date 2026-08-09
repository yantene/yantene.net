# Architecture Decision Records (ADR)

このプロジェクトのアーキテクチャ的に重要な決定の記録。
導入の背景と運用ルールは [0001](0001-record-architecture-decisions.md) と
[.claude/rules/adr.md](../../.claude/rules/adr.md) を参照。

新しい ADR は [template.md](template.md) をコピーして作成する
(ファイル名は `NNNN-kebab-title.md`、連番は既存の最大 +1)。

## 一覧

| #                                                            | タイトル                                                              | Status                                                         |
| ------------------------------------------------------------ | --------------------------------------------------------------------- | -------------------------------------------------------------- |
| [0001](0001-record-architecture-decisions.md)                | アーキテクチャ決定を ADR として記録する                               | Accepted                                                       |
| [0002](0002-value-objects-at-repository-boundaries.md)       | リポジトリ境界では Value Object / ブランド型で受け渡す                | Accepted                                                       |
| [0003](0003-clean-architecture-and-cqrs.md)                  | Clean Architecture (DIP) と CQRS を採用する                           | Accepted                                                       |
| [0004](0004-inertia-server-driven-spa.md)                    | Inertia.js によるサーバー駆動 SPA を採用する                          | Superseded by [0010](0010-react-router-v7-over-inertia.md)     |
| [0005](0005-artifacts-as-content-source-of-truth.md)         | Cloudflare Artifacts をコンテンツの source of truth にする            | Accepted                                                       |
| [0006](0006-mdast-over-html-rendering.md)                    | Markdown を HTML ではなく MDAST でフロントエンドに渡す                | Accepted                                                       |
| [0007](0007-artifacts-read-via-binding-token-and-rest.md)    | Artifacts のファイル読み取りは binding 発行トークン + REST API で行う | Accepted                                                       |
| [0008](0008-github-as-interim-content-backend.md)            | Artifacts 有効化までは GitHub を暫定コンテンツバックエンドにする      | Accepted                                                       |
| [0009](0009-strict-csp-without-unsafe-inline.md)             | CSP を厳格に保ち、見た目は inline ではなく静的な CSS で表現する       | Superseded by [0011](0011-csp-enforced-outside-development.md) |
| [0010](0010-react-router-v7-over-inertia.md)                 | Inertia.js をやめて React Router v7 のフレームワークモードに移行する  | Accepted                                                       |
| [0011](0011-csp-enforced-outside-development.md)             | CSP は development では付けず、staging / production でのみ強制する    | Accepted                                                       |
| [0012](0012-react-router-v8-and-vite-8.md)                   | React Router v8 へ上げ、Vite を 8 系に戻す                            | Accepted                                                       |
| [0013](0013-interactive-day-clock-via-web-animations-api.md) | 時間の表現を Web Animations API で操作可能にする                      | Accepted                                                       |
| [0014](0014-serve-note-source-markdown-verbatim.md)          | ノートの原文 Markdown を R2 から verbatim で配信する                  | Accepted                                                       |
