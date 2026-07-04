# プロダクト概要

## コンセプト

yantene.net は yantene の**発信のすべてを集約するハブ**。

- エッセイ、技術記事、ポートフォリオなど、対外的な発信はここに一本化する
- X、GitHub、Bluesky 等のソーシャルメディアへのポータルでもある
- 特定の読者層は狙わない。自分の言葉を、自分の場所から発信する

### なぜ自作するか

Web サイトは自己表現の場であり、Web 屋として細部にこだわりたい。
既存のブログサービスでは実現できない自由度を確保する。
同時に、新しい技術を試す遊び場としても機能する。

### デザインの方向性

- Celestim（天体アニメーション）は天体へのロマンから
- 装飾は控えめだが、ところどころに遊び心を入れる

## コアドメイン: ノート (Note)

ノートは Markdown 形式の記事で、エッセイ・技術記事・その他の発信を包含する。

- スラグ (slug) ベースの URL ルーティング
- Markdown 本文 + フロントマター（メタデータ）
- 画像等のアセットを記事に紐付けて管理
- ページネーション対応の一覧表示
- SSR によるクローラー・ボット対応

## コンテンツワークフロー

手元で Markdown を書き、Cloudflare Artifacts リポジトリに `git push` する。管理画面は設けない。

## データモデルとストレージ戦略

コンテンツの正本は Cloudflare Artifacts (Git ベースのストレージ) に置く。
D1 はメタデータのインデックス、R2 はパース済み MDAST と画像のキャッシュを担う。
設計判断の詳細は [ADR 0005](../../docs/adr/0005-artifacts-as-content-source-of-truth.md) を参照。

- Artifacts: Markdown 本文 (`notes/<slug>.md`) + 画像アセット (`notes/<slug>/<filename>`)
- D1: メタデータインデックス (スラグ、タイトル、公開日、更新日、要約など)
- R2: パース済み MDAST キャッシュ + 画像キャッシュ

### フロントマターでメタデータ管理

Markdown ファイル自体にメタデータを持たせる。vfile-matter でパースし、
NoteTitle / ImageUrl 等の VO に変換する。

```yaml
---
title: 記事タイトル
imageUrl: ./cover.png       # 相対パス → アセット API URL に解決される
publishedOn: 2026-01-15
lastModifiedOn: 2026-01-20
---
```

### summary は MDAST から自動抽出

一覧表示用の要約は手書きしない。Markdown を MDAST (AST) に変換した後、
見出し・脚注を除いたテキストノードから先頭 160 文字を切り出す。

## コンテンツレンダリング

Markdown をサーバー側で HTML に変換せず、MDAST (Markdown AST) のまま JSON API で返す。
フロントエンド側の MDAST/HAST レンダラーが React コンポーネントに変換する。
設計判断の詳細は [ADR 0006](../../docs/adr/0006-mdast-over-html-rendering.md) を参照。

### 画像はアセット API 経由で配信

Markdown 内の相対パス画像 URL (`./image.png`) を
`/api/v1/notes/<slug>/assets/<path>` に解決する。Artifacts の直接 URL を露出させない。

## 補助ドメイン

- ユーザー認証 (magic link)
- 将来的な機能追加はノートを中心に拡張する
