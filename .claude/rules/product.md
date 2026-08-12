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

手元で Markdown を書き、コンテンツ正本のリポジトリ (`yantene/notes`) に `git push` する。
その後 `POST /api/v1/refresh` を叩くと D1 / R2 へ同期される。管理画面は設けない。

### 実装変更を既存ノートに反映するとき (force refresh)

`POST /api/v1/refresh` の変更検出は **md + アセットのハッシュ**で行う。そのため
「MDAST の作り方を変えた」といった**実装側の変更は、通常の refresh では既存ノートに
反映されない** (ハッシュが変わらないので全件スキップされる)。

MDAST の生成内容や、MDAST から導くメタデータ (要約など) の作り方を変えたら、
デプロイ後に一度 force 付きで叩くこと。

```bash
curl -X POST "<origin>/api/v1/refresh?force=true" -H "X-Refresh-Token: <secret>"
```

過去に該当した変更:

- 画像の width/height 埋め込み ([#99](https://github.com/yantene/yantene.net/issues/99))
- 要約から生 HTML を除外 ([#112](https://github.com/yantene/yantene.net/issues/112))
- 原文 Markdown の R2 キャッシュ ([#106](https://github.com/yantene/yantene.net/issues/106))。
  force refresh を流すまで `/notes/<slug>.md` は 500 になる (fail-loud)
- 数式の MathML 埋め込み ([#174](https://github.com/yantene/yantene.net/issues/174))。
  force refresh を流すまで既存ノートの `$...$` は素の文字列のまま出る
- 本文のむき出し URL のリンクカード ([#172](https://github.com/yantene/yantene.net/issues/172))。
  カードの取得は「変更のあった記事が参照する URL」と「期限切れの既存カード」を対象にするので、
  導入直後は既存記事のリンクが 1 つもカードにならない。一度 force refresh を流すこと

## データモデルとストレージ戦略

コンテンツの正本は GitHub リポジトリ (`yantene/notes`) に置く。
D1 はメタデータのインデックス、R2 は原文 Markdown・パース済み MDAST・画像のキャッシュを担う。
設計判断の詳細は [ADR 0004](../../docs/adr/0004-github-as-content-source-of-truth.md) を参照。

- 正本 (GitHub): Markdown 本文 (`notes/<slug>.md`) + 画像アセット (`notes/<slug>/<filename>`)
- D1: メタデータインデックス (スラグ、タイトル、公開日、更新日、要約など)
- R2: 原文 Markdown キャッシュ + パース済み MDAST キャッシュ + 画像キャッシュ

### フロントマターでメタデータ管理

Markdown ファイル自体にメタデータを持たせる。vfile-matter でパースし、
NoteTitle / ImageUrl 等の VO に変換する。

```yaml
---
title: 記事タイトル
imageUrl: ./cover.png # 相対パス → アセット API URL に解決される
publishedOn: 2026-01-15
lastModifiedOn: 2026-01-20
---
```

### summary は MDAST から自動抽出

一覧表示用の要約は手書きしない。Markdown を MDAST (AST) に変換した後、
見出し・脚注・コードブロック・生 HTML・数式を除いたテキストノードから先頭 160 文字を
切り出す。数式を除くのは、ノードが持つ値が LaTeX 原文で、残すと `\frac{a}{b}` のような
制御綴りが一覧や OGP にそのまま出るため。

生 HTML (`html` ノード) を除くのは、`<s>` や `<div class='box'>` といったタグ文字列が
そのまま要約に出てしまうため。段落中のインライン HTML も対象で、タグに囲まれた本文自体は
別のテキストノードなので要約に残る。

## コンテンツレンダリング

Markdown をサーバー側で HTML に変換せず、MDAST (Markdown AST) のまま JSON API で返す。
フロントエンド側の MDAST/HAST レンダラーが React コンポーネントに変換する。
設計判断の詳細は [ADR 0005](../../docs/adr/0005-mdast-over-html-rendering.md) を参照。

### むき出しの URL はリンクカードになる

段落がリンク 1 つだけでできているとき、リンク先の OGP を読んでカードとして描く
(リスト項目と脚注の中は対象外)。取得は refresh のときだけで、読み手のリクエストは
外部に触れない。取れなければ素のリンクのまま描く。設計判断の詳細は
[ADR 0014](../../docs/adr/0014-link-cards-from-ogp-only.md) を参照。

### 画像はアセット API 経由で配信

Markdown 内の相対パス画像 URL (`./image.png`) を
`/api/v1/notes/<slug>/assets/<path>` に解決する。正本の直接 URL を露出させない。

### 数式は refresh 時に MathML へ組む

本文の `$...$` / `$$...$$` は remark-math で数式ノードにし、**refresh のときに KaTeX の
MathML 出力で組んで MDAST に埋める**。描画側は埋まった MathML を出すだけで、読者に数式
ライブラリは送らない。設計判断の詳細は [ADR 0013](../../docs/adr/0013-math-as-mathml-at-refresh-time.md) を参照。

- KaTeX の既定の HTML 出力は使わない。inline `style` で位置を指定するため CSP 下で崩れる
- 読めない LaTeX は refresh がそのノートをスキップし、理由を返す (fail-loud)
- `$` は数式の開始と見なされる。`$100 と $200` のような書き方は数式になってしまう

### 原文は `/notes/<slug>.md` で取れる

記事ページ (`/notes/<slug>`) の URL 末尾に `.md` を付けると、正本の Markdown を
**そのまま** (フロントマター込み・画像の相対パスも書き換えない) 返す。R2 の原文キャッシュ
から配信し、Hono 側で完結させる (React Router には委譲しない)。設計判断の詳細は
[ADR 0009](../../docs/adr/0009-serve-note-source-markdown-verbatim.md) を参照。

## 補助ドメイン

- 将来的な機能追加はノートを中心に拡張する
