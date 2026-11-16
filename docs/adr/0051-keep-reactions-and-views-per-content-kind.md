# 0051. リアクションと閲覧数を、種別と id の対で指す表に持つ

- Status: Accepted
- Date: 2026-11-16
- Deciders: @yantene

## Context / 背景

リアクション ([0012](0012-emoji-reactions-with-twemoji.md)) と閲覧数・人気順
([0011](0011-reader-session-in-kv.md)) は、記事だけのものではない。読み手が反応し、
読まれた回数で並ぶという仕組みは、サイトに置くコンテンツの種別によらず同じ形をしている。

これらを種別ごとの表 (記事の表の列や、記事の id に FK を張った表) に持つと、種別が
増えるたびに同じ表と同じ書き込みをもう 1 組作ることになる。人気順はとくに困る。
スコアが種別ごとの表に散っていると、種別をまたいで 1 本の順位を出すのに、表の数だけ
並べ替えてから混ぜ直すことになる。

対数スコア (`view_log_score`) は、基準日も重みの付け方も種別によらない
(domain/content-view/view-ranking)。**同じ物差しで測った値なので、種別をまたいで
そのまま比べられる。** 置き場さえ 1 つにすれば、順位は 1 回の並べ替えで出る。

## 検討した選択肢

- **案 A: 種別と id の対で指す表を 1 組持つ (採用)** — `content_reactions` と
  `content_views` が `(kind, content_id)` でコンテンツを指す。
  - Pros: 種別が増えても表も書き込みも増えない。人気順が 1 つの索引で引ける
  - Cons: 指す先の表が種別で変わるので FK を張れない。指す先を消すときの掃除と、
    「指す先 1 つにつき閲覧数の行が 1 つある」ことを、コードが保つことになる
- **案 B: 種別ごとに表と列を持つ** — 記事なら `articles` の列と `article_reactions`、
  ほかの種別にも同じ組を作る。
  - Pros: FK が張れる。閲覧数が本体の行と同じ場所にあり、行の有無を気にしなくてよい
  - Cons: 同じ仕組みが種別の数だけ並ぶ。人気順は種別ごとに上位を引いてから混ぜ直す
    ことになり、混ぜたあとの上位 N 件を出すには各種別から N 件ずつ引く必要がある
- **案 C: 種別ごとの FK 列を並べた表にする** — `article_id` / ほかの種別の id を
  nullable の列として持ち、どれか 1 つだけが埋まる。
  - Pros: FK が張れる
  - Cons: 種別を足すたびに列を足す。「どれか 1 つだけが埋まる」を保つ制約が別に要り、
    NULL を含む列では主キーも組めない

## 決定

案 A を採る。

```
content_reactions (kind, content_id, emoji, count)        PK (kind, content_id, emoji)
content_views     (kind, content_id, view_count, view_log_score)  PK (kind, content_id)
```

- **種別はドメインが決める。** `ContentKind` (domain/shared/content-ref) が取りうる値を
  持ち、コードの中では種別と id を必ず対 (`ContentRef`) で運ぶ。id は種別ごとの表で
  振られるので、id だけでは何を指すかが決まらない。いま在る種別は `article` だけ
- **FK は張らない。掃除は本体の Command リポジトリが行う。** 記事を消すときは、
  記事を指す反応と閲覧数の行を同じ batch で消す
- **閲覧数の行は、本体を初めて保存するときに一緒に作る。** 出発点は投稿日の重みで、
  SQL の既定値では書けない。「足すときに無ければ作る」形にはできないので、本体の
  upsert と同じ batch で用意する。すでに在る行には触らない (作り直しや、取り下げて
  出し直すときに数が巻き戻らないようにするため。[0040](0040-article-status-and-reader-facing-repository.md))
- **人気順は、種別ごとの部分クエリと `content_views` を結合して並べる。** 部分クエリは
  その種別のうち読み手に差し出してよいものの `(kind, id, 公開日)` を出す。
  **公開の条件は部分クエリの中に書く。** 何をもって公開とするかは種別が決めることで、
  結合のあとで絞ると、上位 N 件を下書きが埋めてから落とすことになる
  ([0040](0040-article-status-and-reader-facing-repository.md))

## 帰結 / Consequences

- 良い面: 反応・閲覧数・人気順の仕組みが 1 組で済む。順位は `view_log_score` の索引
  1 本で、種別をまたいで引ける
- 悪い面・トレードオフ:
  - **整合を DB が守らない。** 本体を消す経路が掃除を忘れると、指す先の無い行が残る。
    本体を保存する経路が閲覧数の行を作り忘れると、そのコンテンツは人気順に出てこない
    (結合で落ちる) うえ、閲覧を数える UPDATE も 1 行にも当たらない
  - 人気順が結合を 1 つ挟む。同点の決着に使う公開日は本体の表にあるため
- 検証方法:
  - `article.command-repository.test.ts` が、行が本体と一緒にでき、作り直しでは巻き戻らず、
    本体と一緒に消える (隣の記事は巻き込まない) ことを固定している
  - `content-view.query-repository.test.ts` が、公開されていない記事が上位を埋めないことと、
    同点の決着を固定している
  - `view-ranking.test.ts` が、基準日・半減期・リアクションの重みを数で固定している。
    動かすと記録済みのスコアと意味が食い違う

## 参考 / More Information

- [0011](0011-reader-session-in-kv.md) — 読み直しを数えない。誰が読んだかはセッションが持つ
- [0012](0012-emoji-reactions-with-twemoji.md) — リアクション
- [0040](0040-article-status-and-reader-facing-repository.md) — 記事の status と、人気順を
  status で絞る理由
- [#566](https://github.com/yantene/yantene.net/issues/566)
