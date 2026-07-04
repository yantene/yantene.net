# 0006. Markdown を HTML ではなく MDAST でフロントエンドに渡す

- Status: Accepted
- Date: 2026-07-05
- Deciders: @yantene

## Context / 背景

ノートの Markdown コンテンツをブラウザに表示する方法を決める必要がある。
サーバー側で HTML に変換してから返すか、構造化データ (AST) のまま返すかの選択。

## 検討した選択肢

- **案 A: サーバー側 HTML 変換** — unified/remark/rehype でサーバー側で HTML 文字列に変換し、
  フロントエンドでは `dangerouslySetInnerHTML` 等で挿入する。
  - Pros: フロントエンドの実装がシンプル。HTML を返すだけなので API が単純。
  - Cons: レンダリングの柔軟性がない。目次生成・見出し番号・脚注セクション等の
    カスタマイズにはサーバー側の変換パイプラインを修正する必要がある。
    XSS リスクの管理がサーバー側に集中する。
- **案 B: MDAST (Markdown AST) をフロントエンドに返す** — サーバー側では Markdown を
  MDAST にパースするだけで、React コンポーネントへの変換はフロントエンド側が担う。
  - Pros: フロントエンド側でレンダリングを柔軟に制御できる (目次生成、見出し番号、
    脚注セクション、カスタムコンポーネントの埋め込み等)。サーバーは構造化データを
    返すだけで表示の関心を持たない。
  - Cons: フロントエンドに MDAST/HAST レンダラーの実装が要る。AST のペイロードサイズが
    HTML より大きくなる傾向がある。

## 決定

案 B を採用する。

- サーバー側では Markdown を MDAST にパースし、JSON API で返す
- フロントエンド側の MDAST/HAST レンダラーが React コンポーネントに変換する
- 画像の相対パス (`./image.png`) はアセット API URL (`/api/v1/notes/<slug>/assets/<path>`)
  に解決してからフロントエンドに渡す。Artifacts の直接 URL は露出させない

## 帰結 / Consequences

- 良い面: フロントエンドでの表示カスタマイズの自由度が高い。
  サーバーとフロントエンドの責務が明確に分離される。
- 悪い面: MDAST レンダラーの実装・保守コスト。AST のペイロードサイズ。
- 検証方法: MDAST が正しく React コンポーネントに変換されることを
  Storybook + テストで確認する。

## 参考 / More Information

- [unified](https://unifiedjs.com/) / [remark](https://github.com/remarkjs/remark)
- [0005](0005-artifacts-as-content-source-of-truth.md)
