# 0014. ノートの原文 Markdown を R2 から verbatim で配信する

- Status: Accepted
- Date: 2026-08-10
- Deciders: @yantene

## Context / 背景

`/notes/<slug>.md` で記事の Markdown を取得できるようにしたい ([#106](https://github.com/yantene/yantene.net/issues/106))。
書き手も読み手も原文をそのまま持っていける状態にしておきたく、AI に読ませる用途でも
HTML より Markdown のほうが素直に渡せる。

決めるべき点が 3 つある。

1. 素の Markdown をどこから引くか。正本は Artifacts / GitHub にあり、D1 はメタデータ、
   R2 は MDAST と画像しか持っていない ([0005](0005-artifacts-as-content-source-of-truth.md))。
2. フロントマターを含めるか。
3. 画像の相対パス (`./cover.png`) を素のまま返すか、アセット API URL に書き換えるか。

## 検討した選択肢

- **案 A: リクエストごとに正本 (GitHub / Artifacts) から読む** — `IContentStore.readFile()` を
  配信経路で呼ぶ。
  - Pros: 追加のストレージが要らない。常に最新。
  - Cons: ADR 0005 の「通常のリクエストでは D1 + R2 から配信し、正本には触らない」に反する。
    外部 API のレイテンシ・レート制限・トークンを読み取り経路に持ち込む。
- **案 B: MDAST から Markdown を再生成する** — `mdast-util-to-markdown` で書き戻す。
  - Pros: 既存の R2 キャッシュだけで賄える。画像 URL は解決済み。
  - Cons: 原文にならない (強調記号・改行・コードフェンスが正規化される)。フロントマターは
    MDAST に無いので復元できない。依存が 1 つ増える。
- **案 C: refresh 時に原文を R2 にも置き、そこから配信する** — `INoteContentCache` に
  `putSource` / `getSource` を足す。
  - Pros: ADR 0005 の役割分担 (正本は refresh 時のみ、配信は D1 + R2) を崩さない。
    原文をバイト単位で保てる。読み取りは R2 一発。
  - Cons: R2 に原文のぶんストレージが増える。実装追加時に force refresh が要る。

## 決定

案 C を採用し、返す中身は**正本そのまま (verbatim)** とする。

- refresh 時に `notes/<slug>/source.md` として R2 に原文を保存する。配信は R2 からのみ行う。
- **フロントマターは含める。** フロントマターの項目 (title / imageUrl / tags / publishedOn /
  lastModifiedOn / series / seriesOrder) はすべて JSON API で既に公開しているメタデータで、
  内部向けの項目は存在しない。含めたほうが手元での再利用・再投稿がしやすい。
- **画像の相対パスは書き換えない。** `.md` は「ソースとしてのノート」を返す表現であり、
  そのまま正本のリポジトリに戻せる (round-trip する) ことに価値がある。解決済みの URL が
  要るクライアントには、画像 URL をアセット API URL に解決済みの MDAST を返す JSON API が
  既にある ([0006](0006-mdast-over-html-rendering.md))。
- ルーティングは Hono 側で完結させる ([0010](0010-react-router-v7-over-inertia.md) の分担に従い、
  ページ以外のエンドポイントとして扱う)。`NoteSlug` は `.` を許さないため、`<slug>.md` を
  別のノートと取り違える余地はない。
- `Content-Type: text/markdown; charset=utf-8` + `Content-Disposition: inline; filename="<slug>.md"`。
  ダウンロードを強制せず、保存されたときのファイル名だけ揃える。
- 存在しない slug・slug として不正な文字列は 404 (RFC 9457 Problem Details)。
  D1 にメタデータが在るのに R2 に原文が無い場合はキャッシュ不整合なので、404 で隠さず
  500 で表面化させる (fail-loud)。MDAST が無いときの扱いと揃える。

## 帰結 / Consequences

- 良い面: 読み取り経路が R2 に閉じ、正本への依存が refresh 時だけに保たれる。
  原文がバイト単位で保たれるので、`.md` をそのまま手元やリポジトリへ持っていける。
- 悪い面・トレードオフ: R2 のストレージが原文のぶん増える。`.md` 単体では画像を解決できない。
  フロントマターに内部向けの項目を将来足すなら、この配信をフィルタするか設計を見直す必要がある。
- 検証方法 / 今後の宣言: `markdown.handler.test.ts` が verbatim・ヘッダー・404 / 500 の分岐と、
  `.md` なしの `/notes/<slug>` がページ描画に落ちることを固定する。`notes-refresh.service.test.ts`
  が原文の verbatim キャッシュと削除時の掃除を固定する。
  **既存ノートには原文キャッシュが無いので、デプロイ後に一度 force refresh を流すこと**
  (`.claude/rules/product.md` 参照)。

## 参考 / More Information

- [Issue #106](https://github.com/yantene/yantene.net/issues/106)
- [0005](0005-artifacts-as-content-source-of-truth.md) / [0006](0006-mdast-over-html-rendering.md) /
  [0010](0010-react-router-v7-over-inertia.md)
