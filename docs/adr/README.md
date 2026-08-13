# Architecture Decision Records (ADR)

このプロジェクトのアーキテクチャ的に重要な決定の記録。
導入の背景と運用ルールは [0001](0001-record-architecture-decisions.md) と
[.claude/rules/adr.md](../../.claude/rules/adr.md) を参照。

ADR は「いま、この設計がどうなっていて、なぜそうなのか」を書く。廃案になった選択肢の
変遷や、まだ実装されていない将来計画は書かない。

新しい ADR は [template.md](template.md) をコピーして作成する
(ファイル名は `NNNN-kebab-title.md`、連番は既存の最大 +1)。

## 一覧

| #                                                            | タイトル                                                         | Status   |
| ------------------------------------------------------------ | ---------------------------------------------------------------- | -------- |
| [0001](0001-record-architecture-decisions.md)                | アーキテクチャ決定を ADR として記録する                          | Accepted |
| [0002](0002-value-objects-at-repository-boundaries.md)       | リポジトリ境界では Value Object / ブランド型で受け渡す           | Accepted |
| [0003](0003-clean-architecture-and-cqrs.md)                  | Clean Architecture (DIP) と CQRS を採用する                      | Accepted |
| [0004](0004-github-as-content-source-of-truth.md)            | コンテンツの正本を GitHub に置き、D1 / R2 をキャッシュにする     | Accepted |
| [0005](0005-mdast-over-html-rendering.md)                    | Markdown を HTML ではなく MDAST でフロントエンドに渡す           | Accepted |
| [0006](0006-react-router-framework-mode.md)                  | ページ描画は React Router のフレームワークモードに任せる         | Accepted |
| [0007](0007-strict-csp-outside-development.md)               | CSP に `'unsafe-inline'` を足さず、development でのみ CSP を外す | Accepted |
| [0008](0008-interactive-day-clock-via-web-animations-api.md) | 時間の表現を Web Animations API で操作可能にする                 | Accepted |
| [0009](0009-serve-note-source-markdown-verbatim.md)          | ノートの原文 Markdown を R2 から verbatim で配信する             | Accepted |
| [0010](0010-hand-written-service-worker-without-precache.md) | Service Worker を手書きし、先回りして蓄えない                    | Accepted |
| [0011](0011-reader-session-in-kv.md)                         | 読み手のセッションを KV に置き、同じ日の読み直しを数えない       | Accepted |
| [0012](0012-emoji-reactions-with-twemoji.md)                 | リアクションを一人 1 つに限り、意匠は Twemoji を self-host する  | Accepted |
| [0013](0013-math-as-mathml-at-refresh-time.md)               | 数式は refresh 時に MathML へ組み、MDAST に埋めて配る            | Accepted |
| [0014](0014-link-cards-from-ogp-only.md)                     | リンクカードは OGP だけを見て、取れなければ素のリンクに落とす    | Accepted |
| [0015](0015-twemoji-scoped-to-reaction-ui.md)                | Twemoji はリアクションの UI にだけ当て、ページ全体には当てない   | Accepted |
| [0016](0016-receive-webmentions-in-house.md)                 | Webmention の受信を自前で実装し、検証は非同期に回す              | Accepted |
| [0017](0017-webfonts-from-google-fonts.md)                   | 本文と数式の字を Google Fonts から読み、CSP を 2 ホストに開く    | Accepted |
