# 0038. フィードを種別ごとに分け、`/feed/` の下に並べる

- Status: Accepted
- Date: 2026-09-13
- Deciders: @yantene

## Context / 背景

フィードは `/feed.xml` の 1 本だった。[ADR 0029](0029-retire-tags.md) でタグをやめた
ときに絞り込みの軸が消え、分ける理由が無くなったためである。

その後サイトは 4 つの行き先を名乗るようになった — About / Articles / Notes / Slides
([ADR 0032](0032-call-long-form-posts-articles.md))。Notes (#412) と Slides (#415) は
まだ中身が無いが、ナビには出している。**サイトが何を置く場所なのかは、置き終わる前から
読み手に見えていてよい**という判断である。

読む側の関心はこの軸で分かれる。スライドだけ追いたい人に日記が届き、日記を読みたい人に
スライドが届く。タグのときと違って、この軸は書き手が記事ごとに決めるものではなく、
**投稿の型そのもの**なので、粗すぎたり細かすぎたりすることがない (0029 でタグが働かな
かった理由がここには無い)。

分けるなら、**中身が入る前に決めておく必要がある**。フィードの URL は購読された時点で
動かせない契約になる。後から生やすと、その時点で購読している人が誰もいない状態から
始まり、既に「全部」を購読している人は種別ごとに乗り換えてくれない。

## 検討した選択肢

- **案 A: 種別ごとに 1 本ずつ生やす (採用)** — `/feed.xml` は全体として残し、
  `/feed/articles.xml` / `/feed/notes.xml` / `/feed/slides.xml` を足す。中身の無い種別は
  entry 0 件の Atom を返す。
  - Pros: 読む側が軸を選べる。中身が入る前から購読できるので、入った瞬間に届く。
    リーダー側の設定はフィードの URL が全てなので、実在させておけば後の作業が要らない
  - Cons: Notes / Slides が埋まるまで、All と Articles の中身が同じになる。
    両方を購読した人には同じものが 2 回届く
- **案 B: 1 本のままクエリで絞る** — `/feed.xml?kind=articles`。
  - Pros: 経路が 1 つ。生やす URL が増えない
  - Cons: 0029 で `?tag=` を捨てたのと同じ形に戻る。**リーダーはクエリ付き URL を
    素直に扱わない**ものがあり、正規化で落としたり別フィード扱いにしたりする。
    `rel=alternate` で名指ししても、受け手が同じものと見なす保証が無い
- **案 C: 中身が入ってから生やす** — Notes / Slides が実装された時点で足す。
  - Pros: 空のフィードを抱えない。`<updated>` の据わりが悪い問題も起きない
  - Cons: **その時点の購読者がゼロから始まる。** ナビが行き先を先に見せている方針と
    ちぐはぐで、「読めるのに購読できない場所」が当面残る

## 決定

案 A を採る。

### 行き先は `/feed/` の下に置く

⚠️ **`/articles/feed.xml` にしてはならない。** 記事の原文 Markdown が `/articles/:file`
で登録されている ([ADR 0009](0009-serve-note-source-markdown-verbatim.md))。同じ位置に
静的なパスを足すと、Hono の SmartRouter が RegExpRouter を諦めて TrieRouter に落ち、
**アプリ全体のリクエストが遅いマッチャーを通る**。登録の順を入れ替えても直らない
(静的が先でも後でも落ちる)。

一見すると `/articles/feed.xml` のほうが素直で、次にこれを触る人はそちらへ動かしたく
なる。動かせない理由がここにある。

**`/feed.xml` (全体) は動かさない。** 既に購読されている URL なので、動かすとリーダーの
手元で購読が切れる。`/feed/all.xml` に揃えたくなるが、揃える利益より購読を切る不利益の
ほうが大きい。

### 名乗りは 1 か所から引く

`app/lib/feed.ts` の `feedIdentities` が、種別・title・subtitle・行き先・ページの
対応・選び場所に出す名前を持つ。フィード本体 (Hono のルータ)・ページの
`rel=alternate`・ヘッダーの選び場所・デプロイ後のスモークが、すべてこの表を読む。

**片方にだけある URL を作れない形にしてある。** リーダーは title で購読先を見分けるので、
名前が割れた時点で「同じ名前の別フィード」に見える。

## 帰結 / Consequences

- 良い面: 読む側が軸を選べる。中身が入る前から購読でき、入った瞬間に届く
- 良い面: 種別を足すときに触るのは `feedIdentities` だけで、ルータ・ヘッダー・スモークが
  揃って付いてくる
- 悪い面: **Notes / Slides が埋まるまで、All と Articles の中身は同じ。** 両方を購読した
  人には同じものが 2 回届く。ヘッダーの選び場所からは両方を選べてしまう
- 悪い面: 記事ページなどでは `rel=alternate` が 2 本並ぶ (全体と、その場所のぶん)。
  リーダーの自動検出には両方が出るので、名前で選んでもらうことになる
- トレードオフ: 中身の無いフィードの `<updated>` は、記事が 1 件も無いときの既定値
  (`2026-01-01T00:00:00Z`) を出し続ける。**購読の時点より前の日付**になるので、
  フィードの更新順に並べるリーダーでは最初から最下位に沈む。中身が入れば正しくなるので
  そのままにしてある
- 悪い面: 触る面が増えた。Service Worker の「蓄えない」一覧はその 1 つで、`/feed.xml` の
  完全一致のままだったため、種別ごとのフィードが蓄えられていた (この PR で直した)
- 検証方法: `feed.handler.test.ts` が 4 本すべてが Atom を返すこと・Notes と Slides に
  記事が漏れないこと・title が重ならないことを固定する。`feed-menu.test.tsx` が帯と
  ドロワーに同じ行き先が並ぶことと、種別がナビの行き先と対応することを固定する。
  `service-worker-cache.test.ts` が `public/sw.js` の判定を `feedIdentities` と突き合わせる。
  `markdown.handler.test.ts` の「keeps the whole app on the faster router」が、
  `/articles/` 配下に静的なパスを足したときに落ちる

## 参考 / More Information

- [ADR 0029](0029-retire-tags.md) — フィードが 1 本になった経緯 (タグの廃止)
- [ADR 0009](0009-serve-note-source-markdown-verbatim.md) — `/articles/:file` を占めている側
- [ADR 0032](0032-call-long-form-posts-articles.md) — 行き先を Articles / Notes / Slides に分けた決定
- [#412](https://github.com/yantene/yantene.net/issues/412) — Notes
- [#415](https://github.com/yantene/yantene.net/issues/415) — Slides
