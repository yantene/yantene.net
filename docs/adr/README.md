# Architecture Decision Records (ADR)

このプロジェクトのアーキテクチャ的に重要な決定の記録。
導入の背景と運用ルールは [0001](0001-record-architecture-decisions.md) と
[.claude/rules/adr.md](../../.claude/rules/adr.md) を参照。

ADR は「いま、この設計がどうなっていて、なぜそうなのか」を書く。廃案になった選択肢の
変遷や、まだ実装されていない将来計画は書かない。

新しい ADR は [template.md](template.md) をコピーして作成する
(ファイル名は `NNNN-kebab-title.md`、連番は既存の最大 +1)。

## 一覧

| #                                                            | タイトル                                                             | Status   |
| ------------------------------------------------------------ | -------------------------------------------------------------------- | -------- |
| [0001](0001-record-architecture-decisions.md)                | アーキテクチャ決定を ADR として記録する                              | Accepted |
| [0002](0002-value-objects-at-repository-boundaries.md)       | リポジトリ境界では Value Object / ブランド型で受け渡す               | Accepted |
| [0003](0003-clean-architecture-and-cqrs.md)                  | Clean Architecture (DIP) と CQRS を採用する                          | Accepted |
| [0004](0004-github-as-content-source-of-truth.md)            | コンテンツの正本を GitHub に置き、D1 / R2 をキャッシュにする         | Accepted |
| [0005](0005-mdast-over-html-rendering.md)                    | Markdown を HTML ではなく MDAST でフロントエンドに渡す               | Accepted |
| [0006](0006-react-router-framework-mode.md)                  | ページ描画は React Router のフレームワークモードに任せる             | Accepted |
| [0007](0007-strict-csp-outside-development.md)               | CSP は development でのみ外し、script-src は厳格・style-src は緩める | Accepted |
| [0008](0008-interactive-day-clock-via-web-animations-api.md) | 時間の表現を Web Animations API で操作可能にする                     | Accepted |
| [0009](0009-serve-note-source-markdown-verbatim.md)          | ノートの原文 Markdown を R2 から verbatim で配信する                 | Accepted |
| [0010](0010-hand-written-service-worker-without-precache.md) | Service Worker を手書きし、先回りして蓄えない                        | Accepted |
| [0011](0011-reader-session-in-kv.md)                         | 読み手のセッションを KV に置き、同じ日の読み直しを数えない           | Accepted |
| [0012](0012-emoji-reactions-with-twemoji.md)                 | リアクションは一人 1 つに限り、Twemoji はその UI にだけ当てる        | Accepted |
| [0013](0013-math-as-mathml-at-refresh-time.md)               | 数式は refresh 時に Temml で MathML へ組み、MDAST に埋めて配る       | Accepted |
| [0014](0014-link-cards-from-ogp-only.md)                     | リンクカードは OGP だけを見て、取れなければ素のリンクに落とす        | Accepted |
| [0012](0012-emoji-reactions-with-twemoji.md)                 | リアクションは一人 1 つに限り、Twemoji はその UI にだけ当てる        | Accepted |
| [0016](0016-receive-webmentions-in-house.md)                 | Webmention の受信を自前で実装し、検証は非同期に回す                  | Accepted |
| [0017](0017-webfonts-from-google-fonts.md)                   | 本文と数式の字を Google Fonts から読み、CSP を 2 ホストに開く        | Accepted |
| [0013](0013-math-as-mathml-at-refresh-time.md)               | 数式は refresh 時に Temml で MathML へ組み、MDAST に埋めて配る       | Accepted |
| [0007](0007-strict-csp-outside-development.md)               | CSP は development でのみ外し、script-src は厳格・style-src は緩める | Accepted |
| [0020](0020-negotiate-note-source-markdown-on-accept.md)     | `/notes/<slug>` は Accept を見て原文 Markdown を返す                 | Accepted |
| [0021](0021-measure-reading-with-web-analytics-beacon.md)    | 閲覧は Web Analytics のビーコンで数え、script-src を 1 つ開く        | Accepted |
| [0022](0022-bake-midi-into-opus-and-serve-audio-assets.md)   | 曲は refresh 前に Opus へ焼いて配り、MIDI は原本として添える         | Accepted |
| [0023](0023-render-mermaid-in-the-browser.md)                | Mermaid の図はブラウザで組み、本体は遅延して読む                     | Accepted |
| [0024](0024-clock-origin-from-real-time-at-ssr.md)           | 時計の開き位置を SSR で決め、JST の実時刻と実際の月齢から始める      | Accepted |
| [0014](0014-link-cards-from-ogp-only.md)                     | リンクカードの絵の取り逃しを別の状態として持ち、短い期限で取り直す   | Accepted |
| [0014](0014-link-cards-from-ogp-only.md)                     | リンクカードは短い不調の間だけ前回の中身で持ちこたえる               | Accepted |
| [0028](0028-relate-notes-by-embedding-similarity.md)         | 関連ノートを、refresh 時に作るベクトルの近さで並べる                 | Accepted |
| [0029](0029-retire-tags.md)                                  | タグをやめ、分類は `article` の 1 つに畳む                           | Accepted |

## 統合した番号

同じ主題の ADR が複数に割れたとき、読む側が 1 つのことを知るのに何本も辿らされないよう
統合した。**番号は振り直さない。** リポジトリの外 (コミットメッセージ・マージ済み PR・
Issue) に残る参照が行き先を失うためで、欠番はここで拾う。

| 旧   | 統合先                                         | 主題         |
| ---- | ---------------------------------------------- | ------------ |
| 0015 | [0012](0012-emoji-reactions-with-twemoji.md)   | Twemoji      |
| 0018 | [0013](0013-math-as-mathml-at-refresh-time.md) | 数式         |
| 0019 | [0007](0007-strict-csp-outside-development.md) | CSP          |
| 0025 | [0014](0014-link-cards-from-ogp-only.md)       | リンクカード |
| 0026 | [0014](0014-link-cards-from-ogp-only.md)       | リンクカード |

`scripts/check-adr.mjs` がこの表を読み、消えた番号を指す参照が残っていないかを検査する。
