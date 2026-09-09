# 0033. 長文の記事を指す `note` を、保存とコードの名前からも無くす

- Status: Accepted
- Date: 2026-09-10
- Deciders: @yantene

## Context / 背景

[ADR 0032](0032-call-long-form-posts-articles.md) で長文の投稿を article と呼び、URL と正本の
配置とフロントのコンポーネントを `articles` に揃えた。読み手に見えない名前 (D1 の表と列、
R2 と KV の鍵、バックエンドの識別子、JSON API の応答の鍵) は `note` のまま残していた。

短文の投稿 (#412) を `note` と呼ぶ。そのままだと `Note` / `notes` が「長文」と「短文」の 2 つの
意味でコードと表に同居し、読むたびにどちらの note かを見分けることになる。同居が始まる前に、
長文を指す `note` を全部消す。

## 検討した選択肢

- **案 A: 保存とコードの名前も `article` に揃える (採用)** — 表・列・索引を migration で
  改名し、R2 の鍵を移し、識別子を機械的に置き換える。
  - Pros: `note` が短文だけを指す。読み替えが要らない
  - Cons: 表の改名は後方互換でなく、リリースの瞬間に短い停止が出る。R2 は写し直しが要る
- **案 B: 長文は `Note` のまま残し、短文に別の名 (`Post` など) を付ける** — 何も動かさない。
  - Pros: リリースの停止も写し直しも無い
  - Cons: URL と正本は `articles` なのにコードと表は `notes` という読み替えが恒久になる。
    短文の `note` を別の名で呼ぶ矛盾は ADR 0032 の案 B と同じ
- **案 C: コードだけ改名し、表と R2 の鍵は残す** — 停止と写し直しを避ける。
  - Pros: リリースは通常どおり
  - Cons: `articles` の集約が `notes` 表を読む形になり、短文の `notes` 表を足したときに
    表の名前だけが逆さまのまま残る

## 決定

案 A を採る。

### 改める名前

- D1: 表 `articles` / `article_reactions` / `article_embeddings` / `article_similarities`、
  列 `article_id` / `other_article_id`、索引の名前、FTS5 の `articles_fts`
- R2: `articles/<slug>/` と `og/articles/`
- KV のセッション: `viewedArticles`
- JSON API の応答: 一覧は `articles`、詳細は `article`
- コード: `Article` / `ArticleSlug` / `ArticleTitle` / `ArticleId`、`domain/article`、
  `domain/article-{view,reaction,embedding}`、`handlers/articles/`、services / infra の
  ファイル名。日本語のコメントと文書の「ノート」は「記事」

### `note` のまま残す名前

- 旧 URL としての `/notes/` (ADR 0032 のリダイレクトと Webmention の受け口が持つ文字列)
- `footnote`、GFM の Alert の種別 `note` (`> [!NOTE]`) とその訳語「ノート」。記事とは別の語
- 正本のリポジトリ名 `yantene/notes`
- 一括置換で意味が逆さまになる 2 つは別の名にした。旧 URL からリダイレクトする記事の表は
  `slugsRedirectedFromFormerPath`、OG カードが SVG の先頭の注記を落とす関数は
  `withoutPreamble`

### D1 の改名は 1 段で出す

`ALTER TABLE ... RENAME TO` / `RENAME COLUMN` で名前だけ変え、行は動かさない。索引は改名されないので
落として作り直す。infra が実行時に作る FTS5 の索引は、migration が同じ定義で「無ければ作ってから」
改名する。空の環境 (新規、テスト) でも通り、本番では中身が残る。

environments.md の 2 段リリースは採れない。改名には「読まなくなったコードを先に出す」に当たる
中間状態が無い。`Migrate D1` → `Deploy` の数十秒、旧コードが `no such table: notes` で 500 に
なることを飲み、静かな時間帯に出す。

### R2 の鍵は逃げ道を置いて移す

鍵を一度に切り替えると、force refresh が写し直すまで全記事の原文と MDAST が見つからず 500 になる。
読むときは `articles/<slug>/` を先に見て、無ければ改名前の `notes/<slug>/` に降りる。書くのは
`articles/` だけ。refresh の片付けで旧鍵の下を消す。原文と MDAST は書き終えてから片付けに来るので
無条件に消し、アセットは新しい鍵に写せたものだけ消す (正本に在るのに読めなかったアセットは、
旧鍵の写しが唯一の写しなので残す)。

逃げ道は移行のためのコードで、写し終えたら消す (#430)。OG 画像の旧鍵 `og/notes/` は読まず、
写し直しでは消えないので手で消す。

### KV と JSON API に互換の経路は置かない

セッションの旧記録 `viewedNotes` は読まない。その日にすでに数えた記事を 1 回だけ余計に数える
だけで、セッションは日ごとに捨てる。JSON API の応答の鍵も切り替える。デプロイをまたいで開いた
ままの一覧ページは、次の頁を読むときに旧い鍵を探して止まり、読み直せば直る。

## 帰結 / Consequences

- 良い面: `note` が短文だけを指す。URL・正本・表・鍵・コードの名前が一つに揃う
- 悪い面: リリースの瞬間に数十秒の停止が出る
- 悪い面: 改名のあと force refresh を 1 回流すまで、R2 は逃げ道で読む
- 運用: リリース後に force refresh を流す。処理できた記事の旧鍵は片付けで消える。**refresh が
  `skipped` にした記事は片付けまで来ないので、旧鍵の写しがそのまま残る。** #430 で逃げ道を消す
  前に、`notes/` の下に現行スラグの写しが無いことを一覧で確かめる。正本にもう無いスラグの孤児と
  `og/notes/` は手で消す
- 検証方法: `validate-migrations.mjs` が空の DB で migration を通す。
  `r2-article-content-cache.test.ts` が旧鍵への逃げ道と片付け (写せなかったアセットを残すことを
  含む) を固定する。`article.query-repository.test.ts` が索引の無い状態で検索が空を返すことを
  固定する

## 参考 / More Information

- #429 長文の記事を指す note をコードと保存の名前から無くし、article に揃える
- #430 R2 の旧鍵 `notes/<slug>/` への逃げ道を落とす
- [ADR 0032](0032-call-long-form-posts-articles.md) 長文の投稿を article と呼び、`/articles/<slug>` で配る
