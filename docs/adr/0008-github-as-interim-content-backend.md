# 0008. Artifacts 有効化までは GitHub を暫定コンテンツバックエンドにする

- Status: Accepted
- Date: 2026-07-05
- Deciders: @yantene

## Context / 背景

[0005](0005-artifacts-as-content-source-of-truth.md) で Cloudflare Artifacts を
コンテンツの source of truth に採用し、[0007](0007-artifacts-read-via-binding-token-and-rest.md)
で読み取り方式を定めた。しかし実デプロイ時、Artifacts (beta) が**アカウントで未有効**で
あることが判明した。

```
✘ You do not have access to use Artifacts. Please ensure it is enabled.
  If you are an Enterprise user, reach out to your account team. [code: 10015]
```

トークンには `artifacts` スコープがあるが、アカウント側の feature gate が閉じており、
`ARTIFACTS` binding を含む Worker は **deploy 自体ができない**。有効化には
ウェイトリスト / Enterprise 対応が必要で、時間が読めない。一方でノート機能
(#4-#11) の実装は完了しており、コンテンツ配信 (一覧/詳細/画像) は D1/R2 のみで動く。
Artifacts に触れるのは refresh (正本 → D1/R2 同期) のみ。

幸い、コンテンツ取得口はドメインの `IContentStore` (`listTree` / `readFile`) に
抽象化してあり ([0003](0003-clean-architecture-and-cqrs.md))、バックエンドは
差し替え可能な実装詳細にすぎない。

## 検討した選択肢

- **案 A: Artifacts 有効化を待つ** — deploy をブロックしたまま待機。
  - Pros: 設計変更ゼロ。
  - Cons: 完成した機能を出せない。有効化時期が不定。
- **案 B: GitHub を暫定バックエンドにする (採用)** — `IContentStore` を GitHub
  git tree/blob API で実装し、`ARTIFACTS` binding を外す。
  - Pros: 即 deploy 可能。GitHub API は枯れており tree の `sha` が git blob ハッシュ
    そのものなので、変更検出 (ADR 0005) がそのまま動く。`git push` ワークフローも維持。
  - Cons: コンテンツ正本が Cloudflare 外 (GitHub) になる。将来 Artifacts へ再移行する。
- **案 C: 恒久的に GitHub + R2 へ設計変更** — Artifacts を捨てる。
  - Pros: beta 依存を解消。
  - Cons: 0005 の「Cloudflare 内完結・ネイティブ版管理」という狙いを放棄。時期尚早。

## 決定

**案 B を採用**する。`GitHubContentStore` (`app/backend/infra/github/`) で
`IContentStore` を実装し、`resolveContentStore` の注入先を GitHub 版に切り替える。
`wrangler.jsonc` から `ARTIFACTS` binding と `ARTIFACTS_*` vars を外し、
`GITHUB_OWNER` / `GITHUB_REPO` / `GITHUB_BRANCH` vars + `GITHUB_TOKEN` secret を使う。

`ArtifactsContentStore` (0007 の実装) はコードベースに残す。**Artifacts が有効化されたら、
`resolveContentStore` の注入を `ArtifactsContentStore` に戻し binding を復活させるだけ**で
移行できる (refresh / D1 / R2 / フロントは無変更)。

## 帰結 / Consequences

- 良い面: deploy が通り、ノート機能を出荷できる。変更は「1 実装 + 注入 1 行 + binding」に
  限局し、`IContentStore` 抽象の投資が回収された。
- 悪い面・トレードオフ: 正本が一時的に Cloudflare 外になる。0005/0007 の Artifacts 前提は
  当面保留となる (両 ADR の Status に明記)。
- 検証方法 / 今後の宣言: `resolveContentStore` が `GITHUB_TOKEN` 未設定時に fail-loud で
  throw することを維持 (secure by default)。Artifacts 有効化後は本 ADR を Superseded にし、
  復帰の ADR を起こす。

## 参考 / More Information

- [0005](0005-artifacts-as-content-source-of-truth.md) / [0007](0007-artifacts-read-via-binding-token-and-rest.md)
- 実装: `app/backend/infra/github/github-content-store.ts`
