# Research & Design Decisions

---

**Purpose**: 記事詳細 API (note-detail-api) の設計判断に至る調査結果と根拠を記録する。

---

## Summary

- **Feature**: `note-detail-api`
- **Discovery Scope**: Extension
- **Key Findings**:
  - `remark-parse` (v11) と `remark-frontmatter` (v5) は既にプロジェクトに導入済みであり、Markdown から mdast への変換に追加依存なく対応可能
  - `unist-util-visit` (v5) を新規追加することで mdast ツリーの image ノード走査を型安全に実装できる
  - 既存の `IAssetStorage`、`IMarkdownStorage`、`INoteQueryRepository` インターフェースが記事詳細・アセット配信の両方に十分な API を提供している

## Research Log

### Markdown から mdast への変換パイプライン

- **Context**: 要件 2 で Markdown 本文を mdast 形式に変換する必要がある
- **Sources Consulted**:
  - [remark-parse (npm)](https://www.npmjs.com/package/remark-parse)
  - [unified (GitHub)](https://github.com/unifiedjs/unified)
  - [remark-frontmatter (npm)](https://www.npmjs.com/package/remark-frontmatter)
- **Findings**:
  - `unified` + `remark-parse` で Markdown 文字列を mdast `Root` ノードに変換可能
  - `remark-frontmatter` プラグインを使用すると frontmatter を YAML ノードとして認識し、mdast ツリーから除去可能
  - プロジェクトの `package.json` には `unified@^11.0.5`、`remark-parse@^11.0.0`、`remark-frontmatter@^5.0.0` が既に存在
- **Implications**: 新規パッケージの追加は `unist-util-visit` と `@types/mdast` のみで済む

### mdast 内の画像パス解決

- **Context**: 要件 3 で mdast 内の相対画像パスをアセット配信 API の URL に解決する必要がある
- **Sources Consulted**:
  - [unist-util-visit (npm)](https://www.npmjs.com/package/unist-util-visit)
  - [mdast specification (GitHub)](https://github.com/syntax-tree/mdast)
  - [@types/mdast (npm)](https://www.npmjs.com/package/@types/mdast)
- **Findings**:
  - mdast の `Image` ノードは `url`, `alt`, `title` プロパティを持つ
  - `unist-util-visit` v5 は ESM のみ、TypeScript 完全対応、`visit(tree, 'image', visitor)` で型安全に image ノードのみ走査可能
  - 相対パスの判定は `url` が `http://` または `https://` で始まらないことで判定できる
- **Implications**: `unist-util-visit` を依存に追加し、ドメインレイヤーに mdast 変換ロジックを配置する

### 既存 R2 ストレージのキー構造

- **Context**: アセット配信 API で R2 からアセットを取得する際のキー構造を理解する必要がある
- **Sources Consulted**: `app/backend/infra/r2/note/asset.storage.ts` (既存実装)
- **Findings**:
  - R2 のキープレフィックスは `notes/` で、アセットは `notes/{slug}/{assetPath}` の形式で格納されている
  - `IAssetStorage.get(objectKey)` は `ObjectKey` を受け取り、内部で `notes/` プレフィックスを付与する
  - つまり `ObjectKey.create("{slug}/{assetPath}")` でアセットにアクセス可能
- **Implications**: ハンドラ層で `noteSlug` と `assetPath` を連結して `ObjectKey` を構築する

### MarkdownContent の ReadableStream 処理

- **Context**: `IMarkdownStorage.get()` は `ReadableStream` を返すが、mdast 変換には文字列が必要
- **Sources Consulted**: 既存実装の `notes-refresh.service.ts`
- **Findings**:
  - `ReadableStream` をテキストに変換するため `new Response(stream).text()` パターンが利用可能
  - Cloudflare Workers 環境では Web Streams API が標準で利用可能
- **Implications**: ユースケース層で `ReadableStream` を文字列に変換してから mdast パーサーに渡す

## Architecture Pattern Evaluation

| Option                  | Description                                                        | Strengths                            | Risks / Limitations             | Notes                                               |
| ----------------------- | ------------------------------------------------------------------ | ------------------------------------ | ------------------------------- | --------------------------------------------------- |
| UseCase パターン (採用) | 既存の `ListNotesUseCase` と同様にドメインユースケースクラスを追加 | 既存パターンとの一貫性、テスト容易性 | 追加クラスが増える              | 既存アーキテクチャに完全準拠                        |
| Service パターン        | `NotesRefreshService` のようにサービス層にロジックを配置           | 複合操作に適する                     | 既存の UseCase パターンと不整合 | 本機能は単一集約への問い合わせなので UseCase が適切 |

## Design Decisions

### Decision: mdast 変換ロジックの配置

- **Context**: Markdown 本文を mdast に変換し、画像パスを解決するロジックの配置場所
- **Alternatives Considered**:
  1. ハンドラ層に直接配置 -- 実装は単純だがテスト困難
  2. サービス層に配置 -- 既存の RefreshService と同列
  3. ドメイン層のユースケースに配置 -- 既存パターン準拠
- **Selected Approach**: ドメイン層に mdast 変換関数を配置し、ユースケースから呼び出す
- **Rationale**: 既存の `parseNoteContent` 関数がドメイン層に配置されている前例に倣い、Markdown 処理ロジックはドメインに属する。ユースケースがストレージからの取得と mdast 変換を組み合わせる
- **Trade-offs**: ドメイン層が `unified`/`remark-parse` に依存するが、これは既に `vfile`/`vfile-matter` への依存があるため許容範囲
- **Follow-up**: ドメインレイヤーのインターフェース名に技術固有名称を含めないことを確認

### Decision: frontmatter 除去の方法

- **Context**: mdast に変換する際に frontmatter を除去する方法
- **Alternatives Considered**:
  1. 文字列レベルで `---` 区切りを除去してからパース
  2. `remark-frontmatter` プラグインで YAML ノードとしてパースし、mdast ツリーから除外
- **Selected Approach**: `remark-frontmatter` プラグインを使用して frontmatter を認識させつつ、変換後のツリーから YAML ノードを除外する
- **Rationale**: 既にプロジェクトに導入済みのプラグインを活用でき、文字列操作よりも堅牢。`remark-frontmatter` は frontmatter を専用の YAML ノードとして解析するため、ツリーからフィルタリングするだけで除去可能
- **Trade-offs**: YAML ノードのフィルタリングが必要だが、`unified` のプラグインパイプラインに `remarkFrontmatter` を追加するだけで frontmatter を分離できる

### Decision: アセットパスの構築

- **Context**: `GET /api/v1/notes/{noteSlug}/assets/{assetPath}` で受け取ったパスパラメータから R2 オブジェクトキーを構築する方法
- **Alternatives Considered**:
  1. ハンドラ層で直接 `ObjectKey.create()` を呼び出す
  2. ドメイン層に専用のファクトリメソッドを追加
- **Selected Approach**: ハンドラ層で `{noteSlug}/{assetPath}` を連結して `ObjectKey.create()` を呼び出す
- **Rationale**: `AssetStorage` の実装が `notes/` プレフィックスを自動付与するため、slug とパスの連結はシンプルな文字列操作で十分。ドメイン層に余計な抽象化を追加する必要はない
- **Trade-offs**: ハンドラ層にキー構築の知識が漏れるが、複雑性が低いため許容

## Risks & Mitigations

- **Risk**: `ReadableStream` から文字列への変換でメモリを消費する大きな Markdown ファイル -- **Mitigation**: 実用上、記事の Markdown ファイルは数十 KB 程度であり問題にならない。将来的にサイズ制限を検討
- **Risk**: mdast の構造が unified/remark のバージョンアップで変わる可能性 -- **Mitigation**: `@types/mdast` で型を固定し、テストで mdast 構造を検証
- **Risk**: Hono のルートパラメータ `/:noteSlug/assets/:assetPath` でスラッシュを含むパスが正しく取得できない可能性 -- **Mitigation**: Hono v4 ではワイルドカードパラメータ (`*`) でスラッシュを含むパスをキャプチャ可能。`/:noteSlug/assets/*` パターンの使用を検討

## References

- [remark-parse (npm)](https://www.npmjs.com/package/remark-parse) -- Markdown パーサー
- [unified (GitHub)](https://github.com/unifiedjs/unified) -- コンテンツ変換フレームワーク
- [mdast specification (GitHub)](https://github.com/syntax-tree/mdast) -- Markdown AST 仕様
- [@types/mdast (npm)](https://www.npmjs.com/package/@types/mdast) -- mdast TypeScript 型定義
- [unist-util-visit (npm)](https://www.npmjs.com/package/unist-util-visit) -- unist ツリー走査ユーティリティ
- [remark-frontmatter (npm)](https://www.npmjs.com/package/remark-frontmatter) -- frontmatter パーサープラグイン
- [RFC 9457 Problem Details](https://www.rfc-editor.org/rfc/rfc9457) -- エラーレスポンス標準
