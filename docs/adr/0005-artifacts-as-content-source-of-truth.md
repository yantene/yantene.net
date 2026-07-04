# 0005. Cloudflare Artifacts をコンテンツの source of truth にする

- Status: Accepted
- Date: 2026-07-05
- Deciders: @yantene

## Context / 背景

ノート (Markdown + 画像) の正本をどこに置き、どう配信するかを決める必要がある。
要件は以下の通り。

- 手元で Markdown を書いて `git push` するだけでコンテンツが反映されるワークフロー
- Workers からファイルを効率的に読み取れること
- バージョン管理があると望ましい

## 検討した選択肢

- **案 A: R2 を source of truth にする** — rclone 等で R2 に直接 sync する。
  - Pros: Workers Binding で直接読み取れる。安定 (GA)。ストレージ単価が安い。
  - Cons: バージョン管理がない。sync ツールの設定が別途必要。git ワークフローに乗らない。
- **案 B: GitHub リポジトリ + CI → R2 sync** — GitHub に push → CI で R2 に sync する。
  - Pros: git ワークフロー。CI パイプラインで変換処理を挟める。枯れた構成。
  - Cons: CI の設定・管理が要る。sync の仕組みを自前で書く。GitHub への依存。
- **案 C: Cloudflare Artifacts を source of truth + D1/R2 をキャッシュ** —
  Artifacts に `git push` し、refresh 時に D1 (メタデータ) と R2 (MDAST・画像) に同期する。
  - Pros: `git push` で完結する。Cloudflare エコシステムに閉じる。バージョン管理はネイティブ。
  - Cons: 2026 年 7 月現在 beta。Workers Binding からファイル内容を直接読めず REST API 経由。
    3 層 (Artifacts / D1 / R2) の構成が複雑。

## 決定

案 C を採用する。

- Artifacts をコンテンツの source of truth とする
- D1 にメタデータインデックス (スラグ、タイトル、公開日、要約、blob ハッシュなど) を保持する
- R2 にパース済み MDAST と画像をキャッシュする
- 通常のリクエストでは D1 + R2 から配信し、Artifacts には触らない
- `POST /refresh` 時のみ Artifacts REST API を叩いて D1 と R2 を同期する
- 変更検出は Git blob ハッシュ (SHA-1) で行う。refresh 時に Binding の `readTree` で
  ツリーを取得し、各ファイルの blob ハッシュを D1 の保存済みハッシュと比較する。
  変更があったファイルだけ REST API で内容を取得して再パース・upsert する
- refresh は現時点では手動トリガー。Artifacts にイベントサブスクリプション
  (push イベント) が実装されたら自動同期に移行する

beta を受容する理由: 個人サイトであり、万一サービスが変わっても
コンテンツ自体は手元の git リポジトリに残る。移行コストは限定的。

## 帰結 / Consequences

- 良い面: `git push` だけでコンテンツが反映される自然なワークフロー。
  バージョン管理がネイティブに得られる。Cloudflare 内で完結する。
- 悪い面: Artifacts Binding はファイル読み取りを提供しないため REST API 経由になる。
  3 層構成の複雑さ。beta 故の API 変更リスク。
- 検証方法: refresh フローが Binding (`readTree`) + REST API (変更ファイルのみ) の
  組み合わせで動作し、通常リクエストが Artifacts に触らないことをテストで確認する。

## 参考 / More Information

- [Cloudflare Artifacts Blog](https://blog.cloudflare.com/artifacts-git-for-agents-beta/)
- [Cloudflare Artifacts Docs](https://developers.cloudflare.com/artifacts/)
- [0003](0003-clean-architecture-and-cqrs.md)
