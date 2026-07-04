# 0001. アーキテクチャ決定を ADR として記録する

- Status: Accepted
- Date: 2026-06-04
- Deciders: @yantene

## Context / 背景

本プロジェクトはクリーンアーキテクチャ・CQRS・Inertia など複数の設計判断の上に成り立っているが、
「なぜその選択をしたのか」の根拠はコードや CLAUDE.md からは追えない。時間が経つと意図が失われ、
同じ議論の蒸し返しや、根拠を知らないままの安易な変更 (例: ステージングの BASIC 認証削除) が起きやすい。

## 検討した選択肢

- **案 A: ADR を導入する (docs/adr に Markdown で蓄積)**
  - Pros: 決定と根拠が版管理され、実装 PR と一緒にレビューできる。軽量。
  - Cons: 書く手間と運用ルールが要る。
- **案 B: Wiki / Notion 等の外部ツール**
  - Pros: 編集が容易。
  - Cons: コードと乖離しやすく、版管理・PR レビューの外に出る。
- **案 C: 何もしない (コメントや口頭で済ます)**
  - Pros: コストゼロ。
  - Cons: 根拠が霧散する。現状の課題そのもの。

## 決定

アーキテクチャ的に重要な決定は ADR (Architecture Decision Record) として `docs/adr/` に記録する。
フォーマットは MADR 短縮版 ([template.md](template.md))。運用ルールは
[.claude/rules/adr.md](../../.claude/rules/adr.md) に置く。

## 帰結 / Consequences

- 良い面: 設計判断の「なぜ」が永続化され、オンボーディングと将来の意思決定の土台になる。
- 悪い面: ADR を書く・維持する運用コストが発生する。
- 検証方法: アーキ的に重要な変更を含む PR では、対応する ADR の追加/更新をレビュー観点として求める。

## 参考 / More Information

- Michael Nygard, "Documenting Architecture Decisions"
- MADR: https://adr.github.io/madr/
