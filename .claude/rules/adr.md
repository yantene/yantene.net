# ADR (Architecture Decision Records)

アーキテクチャ的に重要な決定は ADR として `docs/adr/` に記録する。
導入の経緯は [docs/adr/0001](../../docs/adr/0001-record-architecture-decisions.md)、
一覧は [docs/adr/README.md](../../docs/adr/README.md)。

## いつ書くか

後で「なぜ？」と問われる決定、覆すのが高コストな決定、横断的な決定を記録する。例:
認証方式、永続化・スキーマ方針、レイヤー構成、外部サービス選定、重要なトレードオフ。
些末な実装詳細やリバート容易な変更は対象外。

## どう書くか

- フォーマットは MADR 短縮版。`docs/adr/template.md` を雛形にコピーする。
- ファイル名は `NNNN-kebab-title.md` (4 桁連番 + 意図を表すタイトル)。連番は既存の最大 +1。
- Status は `Proposed → Accepted → Deprecated / Superseded by 000X` で遷移させる。
- アーキ的に重要な変更を含む PR では、対応する ADR の追加/更新を行う。

## 不変性 (immutable)

Accepted になった ADR の本文は書き換えない。決定が変わったら新しい ADR を起こし、旧 ADR の
Status 行のみ `Superseded by 000X` に更新してリンクする。「なぜ過去そう決めたか」の履歴を消さないこと。
