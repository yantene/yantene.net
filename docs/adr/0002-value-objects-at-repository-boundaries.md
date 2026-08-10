# 0002. リポジトリ境界では primitive ではなく Value Object / ブランド型で受け渡す

- Status: Accepted
- Date: 2026-06-07
- Deciders: @yantene

## Context / 背景

本プロジェクトでは「不正な状態を型で表現不能にする」を設計原則として掲げている
(architecture.md)。ドメイン層に Value Object (VO) やブランド型を導入して型レベルでの制約表現を
行うが、リポジトリ interface の引数を primitive の `string` で定義すると、VO / ブランド型の
恩恵が境界で失われる。

例えば、以下のような interface では `findBySlug(someTitleString)` のような
slug とタイトルの取り違えをコンパイラが検出できない。

```ts
// primitive で受ける場合
interface INoteQueryRepository {
  findBySlug(slug: string): Promise<Note | undefined>;
}
```

また、正規化の責務が分散する恐れがある。VO は正規化済みだが、primitive を受ける
リポジトリ実装が独自に正規化すると二重処理になる。

## 検討した選択肢

- **案 A: primitive のまま** — interface は `string` で受ける。
  - Pros: infra が VO を import しなくてよい。
  - Cons: 境界で型安全が失われる。取り違えを実行時まで検出できない。正規化責務が分散する。
- **案 B: VO / ブランド型で受ける** — `findBySlug(slug: NoteSlug)`, `delete(id: NoteId)` 等。
  - Pros: 取り違えをコンパイル時に排除。正規化を VO に一元化。原則「型で表現不能に」と整合。
  - Cons: infra/handler が VO を import・組み立てる必要がある。Composition Root で
    `string → NoteId` のブランド化が要る。

## 決定

案 B を採用する。集約のリポジトリ境界は VO / ブランド型で受け渡す。

- `INoteQueryRepository` / `INoteCommandRepository` / `INoteSearchIndex` は `NoteSlug` /
  `NoteTag` / `NoteId` / `Note` を受ける。
- primitive からドメイン境界へ渡す変換 (`NoteSlug.create(...)`, `entityId<"Note">(...)`) は
  Composition Root (handlers/) で行う。

ただし**他の集約を参照するだけの汎用ストアは primitive を維持する**。
`INoteViewCommandRepository` / `INoteViewQueryRepository` は `noteId: string` を受ける。
閲覧記録はノート集約に依存しない独立した集約であり、`NoteId` を要求すると
`domain/note-view` が `domain/note` へ依存して依存方向 (DIP) を崩すため。
string ↔ `NoteId` の変換はストアを使う handler 側が担う。同じ理由で
`INoteQueryRepository.findByIds(ids: readonly string[])` も string を受ける
(閲覧ランキングが返す id の並びをそのまま引くための口)。

## 帰結 / Consequences

- 良い面: slug / タイトル / id の取り違えがコンパイル時に排除される。slug の正規化と
  検証が `NoteSlug` VO に一元化され、リポジトリ実装側の重複検証が消えた。
- 悪い面・トレードオフ: infra/handler が VO を import・組み立てる必要がある。
  集約横断の境界 (string) と集約内の境界 (VO) で受け渡しの語彙が分かれる。
- 検証方法 / 今後の宣言: 新規リポジトリ interface も VO / ブランド型で受けることを
  既定とする。「集約非依存の汎用ストア」のみ string を許容し、その場合は
  本 ADR の理由 (DIP 維持) を踏まえること。

## 参考 / More Information

- architecture.md「不正な状態を型で表現不能にする」「Value Object パターン」
- [0001](0001-record-architecture-decisions.md)
