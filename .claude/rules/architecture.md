# アーキテクチャ方針

## 設計思想

このプロジェクトの設計は以下の原則から導かれる。後述の個別規約は、これらを具体化したもの。
規約に迷ったとき・新しい判断をするときは、まずこの原則に立ち返る。

- **依存性逆転を最優先する (Clean Architecture)** — domain を中心に据え、依存は常に内側
  (domain) へ向ける。ビジネスロジックはインフラ技術 (D1 / KV / Cloudflare 等) を知らない。
  ドメインがインターフェースを定義し、infra/ が実装する。
- **拡張は注入で開く (DI / OCP)** — 具象クラスを生成するのは Composition Root
  (handlers/, `index.ts`) だけ。利用側はインターフェースを注入で受け取る。振る舞いの
  差し替え・追加は「既存コードの修正」ではなく「注入点での差し替え」で行う
  (例: `createSessionMiddleware({ getSessionStore })`, `createMagicLinkRouter({ resolveMailer })`)。
- **不正な状態を型で表現不能にする** — 制約は実行時チェックだけに頼らず型で表す。VO は
  factory でのみ生成 (バリデーション込み) し immutable、ドメインエラーは typed class、
  エンティティの永続化状態は `IPersisted` / `IUnpersisted` でコンパイル時に区別する。
- **静かに劣化させない (fail-loud)** — 設定不備や想定外は、それらしく動き続けるのではなく
  明示的に失敗させる。「設定があれば有効・無ければ無言でスルー」のような存在ベースの
  フォールバックで安全機構を回避しない。
- **安全側の既定値を崩さない (secure by default)** — BASIC 認証・enumeration 対策・
  secure headers・RFC 9457 Problem Details といった既定の防御を、利便性のために緩めたり
  外したりしない。
- **意図を名前と記録に残す** — マイグレーション・ADR・ページファイル名は意図を表す名前にする。
  恒常的な規範は rules/ に、決定の理由は ADR に残す (規範＝可変, ADR＝不変)。
- **小さく・純粋に・宣言的に** — 単一責任、副作用のない純粋関数、非破壊操作、ガード節、TDD を
  コードレベルの既定とする。

## ディレクトリ構造

### トップレベル

```
app/           # アプリケーション本体 (backend / frontend / 共通 lib)
docs/
└── adr/       # Architecture Decision Records (設計判断の記録。詳細は adr.md)
migrations/    # Drizzle 生成のマイグレーション (NNNN_intent.sql) + meta/
public/        # 静的アセット (icons / manifest など。ビルドを介さず配信)
scripts/       # 運用スクリプト (release.sh / validate-migrations.mjs / d1/ ヘルパー)
.claude/
└── rules/     # プロジェクト規約 (CLAUDE.md が @ で読み込む。本ファイルもここ)
.github/       # CI/CD ワークフロー・composite action (詳細は ci-cd.md)
wrangler.jsonc # Cloudflare Workers 設定 (main は app/backend/index.ts を直接指定)
```

### app/ 詳細

```
app/
├── backend/                    # Hono バックエンド
│   ├── domain/                 # ドメイン層（インフラ非依存）
│   │   ├── shared/             # 共通基底インターフェース・VO (IValueObject, ISessionStore 等)
│   │   ├── user/               # User 集約 (entity, Email VO, CQRS repo interface, errors)
│   │   └── auth/               # 認証ドメイン (IMailer, magic-link トークンストア interface)
│   ├── infra/                  # インフラ層（domain のインターフェースを実装）
│   │   ├── d1/                 # D1 (SQLite) 実装
│   │   │   ├── schema/         # Drizzle テーブル定義
│   │   │   ├── repositories/   # CQRS リポジトリ実装 + テスト
│   │   │   ├── temporal.ts     # Temporal.Instant ↔ D1 integer 変換
│   │   │   └── test-helper.ts  # テスト用 D1 ヘルパー
│   │   ├── kv/                 # KV 実装（セッション・magic-link トークン）
│   │   ├── mailer/             # IMailer 実装 (ConsoleMailer 等)
│   │   └── console/            # ConsoleLogger (ILogger 実装)
│   ├── handlers/               # HTTP ハンドラ層（Composition Root）
│   │   ├── api.ts              # JSON API ルータ
│   │   ├── pages.ts            # Inertia ページルータ
│   │   └── auth/               # 認証ハンドラ (magic-link / logout / resolve-mailer)
│   ├── middleware/             # 認証・BASIC 認証・ロケールミドルウェア
│   ├── services/               # アプリケーションサービス層
│   └── index.ts                # バックエンドエントリポイント (Hono app, default export)
├── frontend/                   # Inertia + React アプリケーション
│   ├── pages/                  # Inertia ページコンポーネント (kebab-case)
│   ├── layouts/                # 共通レイアウト (kebab-case)
│   ├── components/             # 再利用 UI コンポーネント (kebab-case・現状未作成・必要時に追加)
│   ├── entry.client.tsx        # クライアントエントリ (createInertiaApp)
│   ├── entry.server.tsx        # SSR エントリ (createInertiaApp + renderToString)
│   ├── root-view.tsx           # HTML シェル (rootView)
│   ├── pages.gen.ts            # ページ名の型定義（生成物）
│   └── app.css                 # Tailwind + daisyUI エントリ
└── lib/                        # フロントエンド・バックエンド共通ユーティリティ
    ├── i18n/                   # ロケール定義・翻訳リソース・初期化ヘルパー
    │   └── locales/            # 言語別翻訳リソース
    └── constants/
```

Cloudflare Worker のエントリポイントは `app/backend/index.ts` の Hono インスタンス
そのもの。`wrangler.jsonc` の `main` に直接指定する。

### 配置ルール

新しいファイルは「どのレイヤーの責務か」で置き場所を決める（依存方向は後述の依存ルールに従う）。

- **ドメインのインターフェース・エンティティ・VO** → `backend/domain/<集約名>/`。
  技術名 (D1 / KV / Cloudflare) を持ち込まない。
- **インフラ実装** → `backend/infra/<技術>/`。domain のインターフェースを実装する。
- **HTTP ハンドラ (Composition Root)** → `backend/handlers/`。具象の生成・注入はここだけ。
  リソースが増えたら `handlers/<resource>/` でサブディレクトリ化する（例: `auth/`）。
- **横断的な前処理** → `backend/middleware/`。
- **複数ハンドラで共有するユースケース** → `backend/services/`（必要になった時点で作成）。
- **画面** → `frontend/pages/`。ファイル名は kebab-case で `c.render('<name>')` と 1:1 対応。
- **再利用 UI** → `frontend/components/`（必要になった時点で作成）。コンポーネントには必ず
  同ディレクトリに `*.stories.tsx` を用意する（CI の `check-stories` ジョブが `scripts/check-stories.mjs`
  で強制する）。
- **フロント・バック両用のユーティリティ** → `app/lib/`。
- **マイグレーション** → `migrations/`。命名は commands.md の規約 (`NNNN_intent`) に従う。
- **設計判断の記録** → `docs/adr/`。命名・運用は adr.md に従う。
- **プロジェクト規約** → `.claude/rules/`。追加したら CLAUDE.md に `@` で登録する。

## Inertia.js のフロー

1. ブラウザが GET `/` などのページリクエストを送る
2. Hono のページルータが `c.render('home', props)` を呼び、`@hono/inertia` ミドルウェアが
   `rootView` 経由で SSR 済み HTML を返す
3. クライアント側で `createInertiaApp` が `#app` 要素の `data-page` を読み hydrate
4. 後続の `<Link>` 遷移は XHR で同じエンドポイントを呼び、JSON のページオブジェクトを取得
5. クライアント側で対応するページコンポーネントが切り替わる

ページ名 (`c.render` の第 1 引数) は `app/frontend/pages/<name>.tsx` と 1:1 で対応する。
ファイル名は **kebab-case で統一する**（case-insensitive ファイルシステムでの衝突防止 +
Linux CI で壊れるパターンの防止）。サブディレクトリで名前空間を切る場合は
`users/index.tsx` のように配置し、`c.render('users/index', ...)` で参照する。

## レイヤー間の依存ルール (DIP / Clean Architecture)

```
依存の方向 →

  domain/  ←  services/  ←  handlers/ / middleware/
                                ↑
                             infra/
```

| レイヤー                     | 許可する依存先                           | 禁止する依存先                            |
| ---------------------------- | ---------------------------------------- | ----------------------------------------- |
| domain/                      | domain 内のみ                            | infra/, services/, handlers/, middleware/ |
| services/                    | domain/ のインターフェース・エンティティ | infra/ の具象クラス、handlers/            |
| infra/                       | domain/ のインターフェース               | services/, handlers/, middleware/         |
| handlers/ (Composition Root) | domain/, services/, infra/, frontend/    | -                                         |
| middleware/                  | domain/, infra/                          | services/, handlers/                      |

Composition Root (handlers/, `app/backend/index.ts`) のみが infra の具象クラスを
インスタンス化し、services に注入する。Inertia ページの props を生成するのも
handlers/ の責務。

## ドメイン層 (app/backend/domain/)

ドメイン層はインフラ技術に依存してはならない。

- クラス名・インターフェース名に D1, R2, KV, Cloudflare 等の技術名を使用禁止
- ドメインがインターフェースを定義し、infra/ が実装する (依存性逆転の原則)

## CQRS リポジトリパターン

リポジトリは Command (書き込み) と Query (読み取り) に必ず分割する。

| 種別     | ドメイン層                          | インフラ層                             |
| -------- | ----------------------------------- | -------------------------------------- |
| 書き込み | `*.command-repository.interface.ts` | `repositories/*.command-repository.ts` |
| 読み取り | `*.query-repository.interface.ts`   | `repositories/*.query-repository.ts`   |

## Value Object パターン

ファイル命名: `*.vo.ts`

- private コンストラクタ + static factory メソッド (バリデーション込み)
- immutable (readonly プロパティ)
- `equals()` / `toJSON()` を実装

## エンティティ永続化状態パターン (必要に応じて採用)

複数の永続化フェーズ (新規作成・DB 復元) を持つエンティティでは、
`IPersisted` / `IUnpersisted` ジェネリクスで DB 保存状態をコンパイル時に区別する。

```typescript
Foo.create(params): Foo<IUnpersisted>       // 新規 (未保存)
Foo.reconstruct(params): Foo<IPersisted>     // DB から復元済み
```

`Counter` のような単純な集約 (常に DB 由来で create / unpersisted を持たない) では
`reconstruct` のみで十分。

## エラーハンドリング

- ドメインエラーは `Error` を継承した typed class として定義する (domain/\*/errors.ts)
- HTTP ステータスへのマッピングは handler 層のみで行う
- ドメイン・サービス層に HTTP の概念を持ち込まない
- API エラーレスポンスは RFC 9457 Problem Details 形式に準拠する
- Inertia ページではエラーは props として渡し、コンポーネント側で表示する

## コーディング原則

- 関数型: 非破壊操作のみ。`toSorted()`, `toReversed()`, `toSpliced()`, `with()` を使用
- 純粋関数: 副作用なし。同じ入力には常に同じ出力
- 宣言的スタイル: `map()`, `filter()`, `reduce()`, `flatMap()` を優先
- 不変性: `readonly`, `as const`
- ガード節: ネストした `if` より早期 `return`
- 単一責任: 1 関数・1 クラスは 1 つのこと。関数は 20 行以内を目安に
- Boolean フラグパラメータ禁止: `upsert(data, true)` ではなく `upsert(data, { preserve: true })`
  または関数を分離する
- TDD: Red → Green → Refactor

## URL 命名規則

URL パスセグメントとクエリパラメータは kebab-case で統一する。

```
✅ /api/v1/notes?per-page=20&sort-by=date
❌ /api/v1/notes?per_page=20&sortBy=date
```

## パスエイリアス

```typescript
import { Foo } from "~/frontend/components/Foo"; // app/ 以下を ~ で参照
```
