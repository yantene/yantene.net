# 0048. 書き手とサイトに `@id` を付け、どのページの構造化データからも指す

- Status: Accepted
- Date: 2026-11-16
- Deciders: @yantene

## Context / 背景

書き手を表す構造化データ (schema.org の `Person`) は何種類ものページに出る。`/about` は
書き手そのものを、記事は筆者 (`author`) と発行者 (`publisher`) を、作品は作った人
(`creator`) を、トップはサイトの持ち主をそれぞれ名乗る。

JSON-LD はページごとに閉じている。別々のページに同じ名前の `Person` が出ていても、読む側
(検索エンジン) にとってそれが同じ 1 人だという根拠は無い。名前の一致は根拠にならない
(同姓同名は実在する)。つながりを言えるのは識別子 `@id` だけで、同じ `@id` を持つ節は
どのページに出ていても同じものを指すと読まれる。

サイトの名前も同じ問題を持つ。検索結果の頭に出るサイト名は `WebSite` の `name` から
決まるが、UI の文言は読み手の言語に追従する (日本語は「やんてね」、英語は `yantene`)。
クローラーは `Accept-Language` を送らないことが多く、既定は英語である。

一方で、機械に名乗ってよい範囲には線が引いてある。生年月日と出身地は機械が読む形で
持たず (#508)、経歴は読み物として画面に出すだけで JSON-LD にも h-card にも出さない
([ADR 0044](0044-show-the-history-as-a-timeline-of-chapters.md))。プロフィールの中身は
コンテンツリポジトリにあり、同期される前は名前と顔の既定値に倒れる
([ADR 0041](0041-keep-the-profile-in-the-content-repository.md))。

## 検討した選択肢

`@id` をどこに置くか。

- **案 A: `<origin>/#person` (サイトのルート + フラグメント)**
  - Pros: ルートは動かない。`@id` は一度配ったら変えられないので、動く余地の無い場所を
    土台にできる。サイト (`#website`) と同じ土台に別のフラグメントで並ぶので、「この
    ドメインのサイト」と「このドメインの人」が対になる。
  - Cons: `@id` の綴りだけを見ても、書き手についてのページがどこかは分からない
    (`url` が `/about` を指すので、読む側は困らない)。
- **案 B: `<origin>/about#person`**
  - Pros: `Person` の本体 (自己紹介・出ていく先) がある場所と、識別子の土台が揃う。
  - Cons: `/about` の URL を変えると、もう無いページを土台にした識別子が残り続ける。
- **案 C: `<origin>/` (フラグメント無しのルート)**
  - Pros: 一番短い。ドメインがそのまま身元、という h-card / `rel="me"` の流儀に合う。
  - Cons: 同じ文字列がトップのページと `WebSite` の `url` でもある。`WebSite` に同じ
    `@id` が付いた時点で、サイトと人が 1 つの節に合体する (名前が「やんてね」と本名の
    両方になる)。サイトの名前と人の名前は別のもの、という線引きが機械の側で消える。
- **案 D: 外の識別子 (GitHub のプロフィールなど) を `@id` にする**
  - Pros: サイトの外でも通じる。
  - Cons: 身元の土台を外のサービスに預けることになる。発信をこの場所に一本化する
    というサイトの前提に反する。外の先は `sameAs` で指せば足りる。

記事とトップからどう指すか。

- **案 E: 本体は `/about` だけに置き、ほかは `@id` で指す**
  - Pros: 記事の数だけ同じ自己紹介を運ばない。食い違う余地が無い。
  - Cons: `@id` だけの裸の参照だと、記事のページ単体では筆者の名前が分からない。
    Google の Article の構造化データは `author` に `name` を求める。
- **案 F: すべてのページに本体をまるごと置く**
  - Pros: どのページも単体で完結する。
  - Cons: 記事を 1 本開くたびに、出ていく先の一覧まで運ぶ。

## 決定

**書き手の `@id` は `<origin>/#person` の 1 つ (案 A)。** 組み立てるのは
`app/backend/handlers/json-ld.ts` の `personId` だけで、`Person` を出す
場所はすべてこのモジュールを通る。origin は要求から取る (canonical と同じ)。production
では `https://yantene.net/#person` になる。

同じ土台に、サイトも別の名札で並べる。

| 何                 | `@id`               | `url`    |
| ------------------ | ------------------- | -------- |
| 書き手 (`Person`)  | `<origin>/#person`  | `/about` |
| サイト (`WebSite`) | `<origin>/#website` | `/`      |

- **フラグメント無しのルートは、どちらの `@id` にも使わない。** サイトと人が合体する (案 C)
- **`/about` のページ (`ProfilePage`) には `@id` を付けない。** 名札が要るのは、ほかの
  場所から指されるものだけ。このページを指す節は無く、付けるなら土台は `/about` に
  なるので、案 B と同じ弱点 (URL を変えると古い識別子が残る) を抱える

**どのページも構造化データを出す。** 少なくとも「自分はこのサイトの一部だ」と名乗る。

| ページ                                         | 型               | 指す先                                                  |
| ---------------------------------------------- | ---------------- | ------------------------------------------------------- |
| トップ                                         | `WebSite`        | `publisher` → 書き手 (同じ `@graph` に `Person` の本体) |
| `/about`                                       | `ProfilePage`    | `mainEntity` に `Person` の本体、`isPartOf` → サイト    |
| 記事                                           | `BlogPosting`    | `author` / `publisher` → 書き手、`isPartOf` → サイト    |
| 作品 (`/works/<slug>`)                         | `CreativeWork`   | `creator` → 書き手、`isPartOf` → サイト                 |
| 一覧 (`/articles` `/works` `/notes` `/slides`) | `CollectionPage` | `isPartOf` → サイト                                     |
| それ以外 (`/legal`、ログインの画面)            | `WebPage`        | `isPartOf` → サイト                                     |

- **サイトを指すのは `@id` だけ。** 人を 1 つにまとめたのと同じ線を、サイトにも張る。
  サイトの名前を言うのはトップの `WebSite` だけにする
- **作品は `creator` で書き手を指す。** 記事の `author` と同じ名前付きの参照で、作った人が
  記事の筆者と同じ 1 人だと言う
- **一覧に載せるのは `url` と `isPartOf` だけ。** 並んでいる中身は写さない (1 件ずつの
  記述はそれぞれのページが持つ)。`url` は canonical と同じで、検索の結果やページ送りの
  途中でも変わらない
- **中身がまだ無いページ (準備中) も名乗る。** その場所が在ることは置き終わる前から言って
  よく、ヘッダーのナビが行き先を先に見せているのと同じ理屈。検索結果に出すかどうかは
  `noindex` が別に決める
- **存在しないページ (404) は名乗らない。** 見つからなかった記事や作品が「自分はこの
  サイトの記事だ」と言うのは嘘になる
- **記事は名前付きの参照にする (案 E に `name` と `url` を足した形)。** `@id` で同じ人だと
  言い、`name` で Google の要件を満たす。自己紹介と出ていく先は載せない
- **トップには本体を置く。** トップは `WebSite` の `publisher` が指す先を同じ `@graph` の
  中に持つ。本体は `/about` と同じ関数から出るので、同じ `@id` の節が場所によって違う
  ことを言わない
- **`WebSite` の `name` は「やんてね」、`alternateName` は `yantene` と `yantene.net` で固定する。**
  翻訳リソースからは引かない。サイトの名前は 1 つで、読み手の言語で変わるものではない
- **`sameAs` に並べるのは相互リンクのある先 (`isMe`) だけ。** h-card の `rel="me"` と同じ
  線引きで、メールは `sameAs` ではなく `email` に置く。並べる先が 1 つも無ければ、
  `sameAs` は欄ごと出さない

**経歴は出さない。** `alumniOf` / `award` / `birthDate` / `birthPlace` / `worksFor` は、`Person` を出す
どの場所にも足さない。身元を 1 つにまとめるのは「どのページの書き手も同じ 1 人だ」と
言うためで、その人について機械に語る量を増やすためではない。ADR 0044 と #508 の線引きは
そのまま守る。

**プロフィールが同期されていないとき。**

- 記事とトップは、**同じ `@id` を指したまま名前だけ既定値に倒す**。トップの `Person` は
  殻 (`@id`・名前・顔・`url`) だけになり、`description` / `sameAs` / `email` は出さない
  (空の `sameAs` を出すと「出ていく先は無い」と名乗ることになる)。`@id` は識別子で
  あって、引けることを約束するものではない。同期された時点で、同じ `@id` の中身が埋まる
- **`/about` も出す。** 「準備中」で `noindex` が立つが、`ProfilePage` として名乗り、
  主題の書き手は殻だけにする。記事とトップが `url` で指している先なので、ここが書き手の
  ページであることは同期の前から変わらない
- 作品は、記事と同じく `creator` の名前だけ既定値に倒す

## 帰結 / Consequences

- 良い面: 読む側から見て、`/about` の人・記事の筆者・サイトの持ち主が 1 人につながる。
  `@id` の綴りが 1 か所にしか無いので、場所ごとにずれることが無い。
- 良い面: 検索結果に出るサイト名が、クローラーの言語に左右されない。
- 悪い面・トレードオフ: **`@id` は一度配ったら動かせない。** 変えると、読む側には別人が
  現れたように見える。ルートを土台にしてあるので、`/about` の URL を変えても `@id` は
  そのままで、`url` だけを直せば済む。
- 悪い面・トレードオフ: staging と production は origin が違うので、`@id` も違う。
  staging は BASIC 認証の内側にあり、クローラーには見えないので実害は無い。
- 良い面: ルートを足すと、`json-ld-wiring.test.ts` が落ちる。構造化データの無いページが
  黙って増えない。
- 悪い面・トレードオフ: 作品のページがプロフィールを 1 回引く (`creator` に名前を入れる
  ため)。
- 検証方法: `json-ld.test.ts` が `@id` の綴りと、本体・参照・同期前の殻・各ページの型の形を
  固定する。各 `pages.handler.test.ts` と `detail.handler.test.ts` が loader の出力を固定し、
  `/about` の欄の許可リストが経歴の混入を見張る。`json-ld-wiring.test.ts` が、全ルートの
  `meta` が構造化データを HTML まで運ぶことと、404 では出さないことを固定する。
  `page-meta.test.ts` が、`@graph` が全ページ共通の出し口を素通りすることを固定する。

## 参考 / More Information

- [ADR 0041](0041-keep-the-profile-in-the-content-repository.md) — プロフィールの置き場と、同期の前の倒れ方
- [ADR 0044](0044-show-the-history-as-a-timeline-of-chapters.md) — 経歴を機械に名乗らない線引き
- [#565](https://github.com/yantene/yantene.net/issues/565)
- [Google: Article の構造化データ](https://developers.google.com/search/docs/appearance/structured-data/article)
- [Google: ProfilePage の構造化データ](https://developers.google.com/search/docs/appearance/structured-data/profile-page)
- [Google: サイト名](https://developers.google.com/search/docs/appearance/site-names)
