# 0007. Artifacts のファイル読み取りは binding 発行トークン + REST API で行う

- Status: Accepted (実装は当面 [0008](0008-github-as-interim-content-backend.md) により保留。Artifacts 有効化後に復帰予定)
- Date: 2026-07-05
- Deciders: @yantene

## Context / 背景

[0005](0005-artifacts-as-content-source-of-truth.md) では、refresh 時に
「Binding の `readTree` でツリーを取得し、変更ファイルだけ REST API で内容を取得する」
と記した。しかし実装時点 (wrangler 4.107) の Artifacts Workers binding
(`interface Artifacts`) が公開するのはリポジトリ管理系メソッド
(`create` / `get` / `import` / `list` / `delete`) と、`ArtifactsRepo.createToken`
によるアクセストークン発行のみで、**ファイル内容やツリーを binding から直接読む
メソッド (`readTree` / `readBlob`) は存在しない**。

したがって「binding でツリー・内容を読む」という 0005 の実装詳細はそのままでは成立せず、
実際に使える API に合わせて読み取り経路を定め直す必要がある。

## 検討した選択肢

- **案 A: アカウント API トークンを secret に置き REST を叩く** — `CLOUDFLARE_API_TOKEN`
  相当をワーカーの secret として持ち、Bearer で Artifacts REST API を呼ぶ。
  - Pros: ドキュメントの REST 認証例と一致。実装が単純。
  - Cons: アカウント全体を操作できる強い API トークンをワーカーに常駐させる。
    secure by default に反する。
- **案 B: binding で repo スコープの read トークンを発行し REST を叩く** — refresh 時に
  `ARTIFACTS.get(repo).createToken("read")` で短命・読み取り専用・リポジトリ限定の
  トークンを発行し、それを Bearer に載せて REST API でツリー・ファイルを読む。
  - Pros: 権限最小化 (read only・repo 限定・短命)。binding を素直に活かす。
  - Cons: リクエストごと (または一定間隔) にトークン発行の往復が要る。REST の
    レスポンス形状が beta で不確定。

## 決定

案 B を採用する。0005 の「Artifacts を source of truth、D1/R2 をキャッシュ、blob
ハッシュで変更検出」という骨子は維持したまま、**読み取り経路のみ**を次のように定める。

- ドメインは技術非依存の `IContentStore` (`listTree()` / `readFile(path)`) を定義する。
- infra の `ArtifactsContentStore` が実装し、Artifacts binding で発行した read トークンを
  Bearer に載せて REST API を呼ぶ。
  - ツリー: `GET /accounts/:acct/artifacts/namespaces/:ns/repos/:repo/tree/:ref`
  - ファイル: `GET /accounts/:acct/artifacts/namespaces/:ns/repos/:repo/file?ref=&path=`
- 変更検出は 0005 通り、ツリーが返す各ファイルのハッシュを D1 の保存済みと比較する。
- accountId は secret (`ARTIFACTS_ACCOUNT_ID`)、namespace / repo / branch は wrangler の
  vars で与える。未設定時は静かに劣化させず fail-loud で throw する。

## 帰結 / Consequences

- 良い面: 権限最小のトークンで読み取れる。ドメインは Artifacts を知らないまま
  (`IContentStore`)、実装差し替えが効く。0005 の設計意図を壊さない。
- 悪い面・トレードオフ: REST レスポンス (特に tree の JSON 形状) が beta のため未確定で、
  実 API との突き合わせで解析の微修正が要る可能性がある。解析は
  `parseTreeResponse` に隔離し、そこだけ直せば済むようにしてある。
- 検証方法: `ArtifactsContentStore` を fetch モックでユニットテストする。実 Artifacts
  リポジトリを用意でき次第、tree レスポンス形状を突き合わせて `parseTreeResponse` を確定する。

## 参考 / More Information

- [0005](0005-artifacts-as-content-source-of-truth.md)
- [Cloudflare Artifacts REST API](https://developers.cloudflare.com/artifacts/api/rest-api/)
- [Cloudflare Artifacts Workers binding](https://developers.cloudflare.com/artifacts/api/workers-binding/)
