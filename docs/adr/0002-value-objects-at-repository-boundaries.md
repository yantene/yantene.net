# 0002. リポジトリ境界では primitive ではなく Value Object / ブランド型で受け渡す

- Status: Accepted
- Date: 2026-06-07
- Deciders: @yantene

## Context / 背景

ドメイン層には `Email` VO と `EntityId<"User">` (= `UserId`) ブランド型があり、
「不正な状態を型で表現不能にする」という設計原則 (architecture.md) を支えている。
ところがリポジトリ interface はこれらを使わず primitive の `string` で受けていた。

```ts
// 旧
interface IUserQueryRepository {
  findById(id: string): Promise<User | undefined>;
  findByEmail(email: string): Promise<User | undefined>;
}
```

この結果、VO/ブランド型を用意した目的 (型レベルでの取り違え防止) が境界で失われ、
`findById(someEmailString)` のような取り違えをコンパイラが検出できなかった。
さらに正規化の責務が分散し、`findByEmail` 実装側で `email.toLowerCase()` する一方、
`save` は VO に正規化を委ねる、という二重正規化が生じていた。

## 検討した選択肢

- **案 A: primitive のまま (現状維持)** — interface は `string` で受ける。
  - Pros: 変更不要。infra が VO を import しなくてよい。
  - Cons: 境界で型安全が失われる。取り違えを実行時まで検出できない。正規化責務が分散する。
- **案 B: VO / ブランド型で受ける** — `findByEmail(email: Email)`, `delete(id: UserId)` 等。
  - Pros: 取り違えをコンパイル時に排除。正規化を VO に一元化。原則「型で表現不能に」と整合。
  - Cons: infra/handler が VO を import・組み立てる必要がある。Composition Root で
    `string → UserId` のブランド化が要る。

## 決定

案 B を採用する。ユーザー集約のリポジトリ境界は VO / ブランド型で受け渡す。

- `IUserQueryRepository` / `IUserCommandRepository` は `Email` / `UserId` を受ける。
- primitive (session の `userId` 文字列など) からドメイン境界へ渡す変換 (`entityId<"User">(...)`)
  は Composition Root (handlers/) で行う。

ただし `ISessionStore` は `userId: string` を維持する。session ストアはユーザー集約に
依存しない汎用ストアであり、`UserId` を要求すると infra/shared がユーザー集約へ依存して
依存方向 (DIP) を崩すため。string ↔ UserId の変換はストアを使う handler 側が担う。

## 帰結 / Consequences

- 良い面: ユーザー集約に関する ID/メアドの取り違えがコンパイル時に排除される。
  email 正規化が `Email` VO に一元化され、`findByEmail` 実装の重複正規化が消えた。
- 悪い面・トレードオフ: infra/handler が VO を import・組み立てる必要がある。
  session 境界 (string) とユーザー集約境界 (VO) で受け渡しの語彙が分かれる。
- 検証方法 / 今後の宣言: 新規リポジトリ interface も VO / ブランド型で受けることを
  既定とする。session 等「集約非依存の汎用ストア」のみ string を許容し、その場合は
  本 ADR の理由 (DIP 維持) を踏まえること。

## 参考 / More Information

- architecture.md「不正な状態を型で表現不能にする」「Value Object パターン」
- [0001](0001-record-architecture-decisions.md)
