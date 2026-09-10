# 0035. コンテンツリポジトリへの push は Queue で受け、同期を直列に走らせる

- Status: Proposed
- Date: 2026-09-11
- Deciders: @yantene

## Context / 背景

[0034](0034-artifacts-as-content-source-of-truth.md) でコンテンツリポジトリを Cloudflare Artifacts に移す。
これまで同期 (refresh) を起こしていたのはコンテンツリポジトリ側の GitHub Actions で、push を
受けて `POST /api/v1/refresh` を叩いていた。**GitHub Actions は Artifacts の push を
知らない**ので、この経路は切れる。

refresh は「コンテンツリポジトリのいまの姿を D1 / R2 に写す」処理で、コミットを 1 つずつ辿るのではない。
だから複数の push をまとめて 1 回で済ませられる一方、**走る順番が入れ替わると古い姿で
固まる**。

## 検討した選択肢

- **案 A: Queue の event subscription で受ける (採用)** — Artifacts の
  `cf.artifacts.repo.pushed` を Queue に流し、Worker の `queue()` で受ける。
  - Pros: 受け口が増えるだけで、同期の中身は既存の `runRefresh` をそのまま呼べる。
    並行度を `max_concurrency` で縛れる。いまの wrangler で足りる
  - Cons: Queue というリソースが 1 つ増える
- **案 B: `triggers.events` で Workflow を起こす** — push で Workflow を直接起動する。
  - Pros: Cloudflare のガイドが示している経路。ステップ単位の再試行が付く
  - Cons: refresh を Workflow クラスに包み直すことになる。多段の耐久性が要る処理ではない。
    wrangler 4.129 以降の設定項目で、いまのバージョンでは書けない
- **案 C: GitHub Actions から叩き続ける** — コンテンツリポジトリを Artifacts に移しても、GitHub 側に
  ミラーして push を検知する。
  - Cons: コンテンツリポジトリが 2 つある状態を恒久化する。0034 でコンテンツリポジトリを 1 つに閉じた意味が無くなる

## 決定

案 A を採る。

- **`cf.artifacts.repo.pushed` を Queue に流し、`queue()` ハンドラで受ける。**
  `payload.ref` が読んでいるブランチ (`refs/heads/<ARTIFACTS_BRANCH>`) のときだけ走らせる
- **1 バッチにつき同期は多くても 1 回。** 立て続けの push は 1 回にまとまる。refresh は
  いまの姿に揃える処理なので、まとめても取りこぼさない
- **`max_concurrency` は 1。** ここが肝で、下に理由を書く
- **読んでいるコンテンツリポジトリが Artifacts でない環境では何もしない。** `CONTENT_SOURCE` が `github`
  のときに走らせると、Artifacts の push を合図に GitHub の中身を同期することになる
- **落ちたら ack せずに投げ返す。** Queue が再試行する (`max_retries` は 3)

### 購読はリポジトリに 1 つだけ

**同じリポジトリに購読を 2 つ張れない** (`We currently do not support multiple subscriptions
on the same resource.`)。1 つのリポジトリの push を staging と production の両方の Queue へ
流すことはできないので、**環境ごとにリポジトリを分ける** (`yantene-production` /
`yantene-staging`。[0034](0034-artifacts-as-content-source-of-truth.md))。

張り方で 2 つ、文書に無いことがある。どちらも API のエラーで分かった。

- **購読するイベントの名前は `pushed`。** メッセージ本体の `type` は
  `cf.artifacts.repo.pushed` だが、購読を作るときに渡すのは接頭辞の無いほう
- **`wrangler queues subscription create` では張れない。** リポジトリを指す
  `source.namespace` / `source.repo_name` が必須なのに、それを渡すオプションが CLI に無い
  (4.130 時点)。`POST /accounts/:id/event_subscriptions/subscriptions` を直接叩く

### 同時に走らせない (競合)

refresh は「読む → 書く」を続けて行う。並行して走らせると、こうなる。

1. push A → refresh(A) が開始し、コンテンツリポジトリの状態 A を読む
2. push B → refresh(B) が並行して開始し、状態 B を読む
3. refresh(B) が先に書き終わる
4. **refresh(A) が後から書き、D1 / R2 は古い状態 A で固まる**

**次の push が来るまで直らない。** 書き手から見れば「push したのに反映されない」で、
しかも再現しない。

`max_concurrency` を 1 にすると、2 回目は 1 回目が書き終わってから走り、**そのとき最新の
コンテンツリポジトリを読み直す**。だから最後の push の状態が必ず最後に書かれる。順番が入れ替わらないことを
Queue の側で保証させる。

排他を自前で持つ (Durable Object のロック、D1 のフラグ) 方法もあるが、ロックの解放漏れと
いう別の失敗を抱え込む。Queue の設定 1 行で足りるものに機構を足さない。

### 手で叩く口は残す

`POST /api/v1/refresh` は消さない。**push は「変わったものを取り込め」という合図でしかなく、
「全部やり直せ」を意味する push は存在しない。** 実装を変えたときに既存の記事へ反映させる
force refresh の口として残す (product.md に、force が要った変更が並んでいる)。

- 通常の同期 → Queue から (自動)
- force refresh → `POST /api/v1/refresh?force=true` を `REFRESH_SECRET` で保護して残す

## 帰結 / Consequences

- 良い面: push から同期までが Cloudflare の中で閉じる。コンテンツリポジトリ側に secret と
  ワークフローを置かなくてよくなる。同期の中身 (`runRefresh`) は HTTP と Queue で共通
- 悪い面: 直列なので、同期が詰まると後続が待つ。通常の refresh は 3 秒ほどなので当面は
  問題にならないが、記事が増えれば伸びる
- 悪い面: 再試行を使い切って落ちた push は、次の push まで反映されないままになる。
  気づく仕組み (dead letter queue か通知) は別に要る
- 運用: これが動いたら、`yantene/notes` の `refresh.yml` と GitHub secret の
  `PRODUCTION_REFRESH_SECRET` / `STAGING_REFRESH_SECRET` は死ぬ
- 検証方法: `refresh-queue.handler.test.ts` が、読んでいるブランチへの push でだけ走ること、
  バッチをまとめて 1 回にすること、コンテンツリポジトリが Artifacts でない環境で何もしないこと、
  落ちたら ack しないことを固定する

## 参考 / More Information

- [0034](0034-artifacts-as-content-source-of-truth.md) コンテンツリポジトリを Cloudflare Artifacts に置く
- [#401](https://github.com/yantene/yantene.net/issues/401)
- [Artifacts のイベント購読](https://developers.cloudflare.com/artifacts/guides/event-subscriptions/) /
  [Queues の consumer 設定](https://developers.cloudflare.com/queues/configuration/configure-queues/)
